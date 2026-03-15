import { NextRequest } from 'next/server'
import { getAuthenticatedProfile } from '@/lib/auth'
import {
  getOrCreateItemConversation,
  getConversationMessages,
  appendConversationMessage,
  getItemAssessment,
  updateItemAssessment,
} from '@/mcp'
import { composePerItemChatPrompt } from '@/lib/per-item-chat-prompt'
import { useCliMode, runCliAgentLoop, type ToolDefinition } from '@/lib/claude-cli'
import { getAnthropicApiKey, refreshAnthropicApiKey } from '@/lib/dev-api-key'
import type { UserProfile } from '@/types/database'

// ─── Tool definitions for per-item chat ──────────────────────────────────────

const CHAT_TOOLS: ToolDefinition[] = [
  {
    name: 'render_assessment_card',
    description:
      'Display an updated assessment card when your recommendation changes based on new information from the user.',
    input_schema: {
      type: 'object',
      properties: {
        item: { type: 'string', description: 'Item name' },
        verdict: {
          type: 'string',
          enum: ['SHIP', 'SELL', 'DONATE', 'DISCARD', 'CARRY', 'REVISIT'],
        },
        confidence: { type: 'number', description: 'Confidence score 0–100' },
        rationale: {
          type: 'string',
          description: '1–3 sentences: voltage, cost, restrictions',
        },
        action: { type: 'string', description: 'One concrete next step' },
        import_note: {
          type: 'string',
          description: 'Biosecurity or customs restriction. Omit if none.',
        },
        item_description: { type: 'string', description: 'Brief description' },
        voltage_compatible: {
          type: 'boolean',
          description: 'Works at destination voltage',
        },
        needs_transformer: {
          type: 'boolean',
          description: 'Needs voltage transformer',
        },
        estimated_ship_cost_usd: {
          type: 'number',
          description: 'Shipping cost in departure currency',
        },
        currency: { type: 'string', description: 'Currency code' },
        estimated_replace_cost_usd: {
          type: 'number',
          description: 'Replacement cost at arrival',
        },
        replace_currency: { type: 'string', description: 'Currency code' },
      },
      required: ['item', 'verdict', 'confidence', 'rationale', 'action'],
    },
  },
  {
    name: 'update_item_assessment',
    description:
      'Persist changes to the item assessment in the database. Call this after render_assessment_card when you have updated your recommendation.',
    input_schema: {
      type: 'object',
      properties: {
        verdict: {
          type: 'string',
          enum: ['SHIP', 'SELL', 'DONATE', 'DISCARD', 'CARRY', 'REVISIT'],
        },
        advice_text: { type: 'string', description: 'Updated rationale text' },
        confidence: { type: 'number', description: 'Updated confidence score' },
        voltage_compatible: { type: 'boolean' },
        needs_transformer: { type: 'boolean' },
        estimated_ship_cost: { type: 'number' },
        currency: { type: 'string' },
        estimated_replace_cost: { type: 'number' },
        replace_currency: { type: 'string' },
      },
      required: [],
    },
  },
]

// ─── API key resolution ───────────────────────────────────────────────────────

function getApiKey(profile: UserProfile): string {
  if (process.env.NODE_ENV === 'development') {
    return getAnthropicApiKey()
  }
  return profile.anthropic_api_key ?? process.env.ANTHROPIC_API_KEY ?? ''
}

// ─── Route handler ────────────────────────────────────────────────────────────

// POST /api/items/:id/chat
// Sends a user message and streams Aisling's response via Server-Sent Events.
// Conversation history is persisted per-item. Assessment updates are persisted
// when Aisling calls the update_item_assessment tool.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, profile: maybeProfile } = await getAuthenticatedProfile()
  if (!user || !maybeProfile) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }
  // Narrowed to non-null after the guard above
  const profile = maybeProfile

  const { id: itemId } = await params
  const body = await req.json()
  const userMessage = body.message as string

  if (!userMessage?.trim()) {
    return Response.json({ error: 'Message is required' }, { status: 400 })
  }

  // Fetch item and verify ownership
  const item = await getItemAssessment(itemId, profile.id)
  if (!item) {
    return Response.json({ error: 'Item not found' }, { status: 404 })
  }

  // Get or create conversation, save user message, load history
  const conversation = await getOrCreateItemConversation(itemId, profile.id)
  await appendConversationMessage(conversation.id, 'user', userMessage)
  const messages = await getConversationMessages(conversation.id)

  // Compose system prompt
  const systemPrompt = await composePerItemChatPrompt(profile, item)

  // Build messages array for LLM (role + content pairs)
  const llmMessages = messages.map((m) => ({ role: m.role, content: m.content }))

  const model = process.env.MODEL_AISLING ?? 'claude-sonnet-4-6'

  // ─── Tool executor ─────────────────────────────────────────────────────────

  async function executeTool(
    name: string,
    input: Record<string, unknown>
  ): Promise<string> {
    if (name === 'render_assessment_card') {
      // Card rendering is handled client-side via the 'card' SSE event
      return JSON.stringify({ ok: true, rendered: true })
    }

    if (name === 'update_item_assessment') {
      try {
        const changes: Record<string, unknown> = {}
        if (input.verdict) changes.verdict = input.verdict
        if (input.advice_text) changes.advice_text = input.advice_text
        if (input.confidence !== undefined) changes.confidence = input.confidence
        if (input.voltage_compatible !== undefined) changes.voltage_compatible = input.voltage_compatible
        if (input.needs_transformer !== undefined) changes.needs_transformer = input.needs_transformer
        if (input.estimated_ship_cost !== undefined) changes.estimated_ship_cost = input.estimated_ship_cost
        if (input.currency) changes.currency = input.currency
        if (input.estimated_replace_cost !== undefined) changes.estimated_replace_cost = input.estimated_replace_cost
        if (input.replace_currency) changes.replace_currency = input.replace_currency

        await updateItemAssessment(
          itemId,
          changes as Parameters<typeof updateItemAssessment>[1],
          profile.id
        )
        return JSON.stringify({ ok: true, updated: true })
      } catch (err) {
        return JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : 'Failed to update',
        })
      }
    }

    return JSON.stringify({ ok: false, error: `Unknown tool: ${name}` })
  }

  // ─── Streaming response ────────────────────────────────────────────────────

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let fullAssistantText = ''

      try {
        if (useCliMode()) {
          // CLI path — runCliAgentLoop handles the multi-turn tool-use loop
          fullAssistantText = await runCliAgentLoop(
            systemPrompt,
            llmMessages,
            CHAT_TOOLS,
            model,
            controller,
            executeTool
          )
        } else {
          // SDK path — multi-turn tool-use loop
          const Anthropic = (await import('@anthropic-ai/sdk')).default
          let apiKey = getApiKey(profile)
          const client = new Anthropic({ apiKey })

          const sdkTools = CHAT_TOOLS.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.input_schema,
          }))

          let currentMessages = llmMessages.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }))

          for (let round = 0; round < 10; round++) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let response: any
            try {
              response = await client.messages.create({
                model,
                max_tokens: 4096,
                system: systemPrompt,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                tools: sdkTools as any,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                messages: currentMessages as any,
              })
            } catch (err) {
              // Retry once on 401 in development (refreshes keychain token)
              if (
                process.env.NODE_ENV === 'development' &&
                err instanceof Error &&
                err.message.includes('401')
              ) {
                apiKey = refreshAnthropicApiKey()
                const retryClient = new Anthropic({ apiKey })
                response = await retryClient.messages.create({
                  model,
                  max_tokens: 4096,
                  system: systemPrompt,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  tools: sdkTools as any,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  messages: currentMessages as any,
                })
              } else {
                throw err
              }
            }

            let hasToolUse = false
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const toolResults: any[] = []

            for (const block of response.content) {
              if (block.type === 'text') {
                fullAssistantText += block.text
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(block.text)}\n\n`)
                )
              } else if (block.type === 'tool_use') {
                hasToolUse = true

                // Emit tool_call event for observability
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      __type: 'tool_call',
                      name: block.name,
                      input: block.input,
                    })}\n\n`
                  )
                )

                // Emit card data for render_assessment_card so the client can
                // render the updated card inline in the chat
                if (block.name === 'render_assessment_card') {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        __type: 'card',
                        ...(block.input as Record<string, unknown>),
                      })}\n\n`
                    )
                  )
                }

                const result = await executeTool(
                  block.name,
                  block.input as Record<string, unknown>
                )

                // Emit tool_result event for observability
                let parsedResult: unknown = result
                try {
                  parsedResult = JSON.parse(result)
                } catch {
                  // keep raw string
                }
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      __type: 'tool_result',
                      name: block.name,
                      result: parsedResult,
                    })}\n\n`
                  )
                )

                toolResults.push({
                  type: 'tool_result' as const,
                  tool_use_id: block.id,
                  content: result,
                })
              }
            }

            if (!hasToolUse || response.stop_reason === 'end_turn') break

            // Feed tool results back for the next round
            currentMessages = [
              ...currentMessages,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              { role: 'assistant' as const, content: response.content as any },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ...toolResults.map((tr) => ({ role: 'user' as const, content: [tr] as any })),
            ]
          }
        }

        // Persist the assistant's full response
        if (fullAssistantText.trim()) {
          await appendConversationMessage(conversation.id, 'assistant', fullAssistantText)
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        console.error('[per-item-chat] Error:', err)
        const errorMsg = err instanceof Error ? err.message : 'Unexpected error'
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ __type: 'error', message: errorMsg })}\n\n`
          )
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
