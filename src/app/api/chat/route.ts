import fs from 'fs'
import path from 'path'
import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  appendMessage,
  findOrCreateSession,
  getMessages,
  saveItemAssessment,
  updateItemAssessment,
  getItemAssessments,
  getCostSummary,
  createBox,
  addItemToBox,
  updateBoxCbm,
  setAllBoxesShipped,
  getBoxes,
  removeItemFromBox,
} from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'
import { getAnthropicApiKey, refreshAnthropicApiKey } from '@/lib/dev-api-key'
import { useCliMode, runCliAgentLoop, type ToolDefinition } from '@/lib/claude-cli'
import { BoxSize, BoxType, Country } from '@/lib/constants'

// ─── Helpers ───────────────────────────────────────────────────────────────

function stripYamlFrontmatter(content: string): string {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/)
  return match ? content.slice(match[0].length) : content
}

function readKnowledgeFile(relativePath: string): string {
  const fullPath = path.join(process.cwd(), 'knowledge', relativePath)
  try {
    return fs.readFileSync(fullPath, 'utf-8')
  } catch {
    return ''
  }
}

function readAislingPersona(): string {
  const fullPath = path.join(process.cwd(), '.claude', 'agents', 'aisling.md')
  try {
    const raw = fs.readFileSync(fullPath, 'utf-8')
    return stripYamlFrontmatter(raw)
  } catch {
    console.warn('[chat] Could not read aisling.md persona file')
    return ''
  }
}

function countryToModuleCode(country: string): string {
  const code = country.toLowerCase()
  const validCodes = Object.values(Country).map((c) => c.toLowerCase())
  if (!validCodes.includes(code)) return ''
  return code
}

function countryToCurrency(country: string): string {
  const map: Record<string, string> = {
    US: 'USD',
    IE: 'EUR',
    AU: 'AUD',
    CA: 'CAD',
    UK: 'GBP',
    NZ: 'NZD',
  }
  return map[country.toUpperCase()] ?? 'USD'
}

// ─── Tool definitions ───────────────────────────────────────────────────────

const AISLING_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'save_item_assessment',
    description:
      'Save a confirmed item assessment to the database. Call this after the user confirms or clearly accepts a verdict.',
    input_schema: {
      type: 'object' as const,
      properties: {
        item_name: { type: 'string', description: 'Name of the item' },
        verdict: {
          type: 'string',
          enum: ['SHIP', 'CARRY', 'SELL', 'DONATE', 'DISCARD', 'DECIDE_LATER'],
          description: 'Disposition verdict',
        },
        advice_text: { type: 'string', description: 'Aisling\'s advice text for this item' },
        item_description: { type: 'string', description: 'Description of the item' },
        image_url: { type: 'string', description: 'URL of uploaded item image if provided' },
        voltage_compatible: {
          type: 'boolean',
          description: 'Whether the item is voltage-compatible with the destination',
        },
        needs_transformer: {
          type: 'boolean',
          description: 'Whether the item needs a voltage transformer',
        },
        estimated_ship_cost: {
          type: 'number',
          description: 'Estimated shipping cost in departure currency',
        },
        currency: {
          type: 'string',
          description: 'Currency code for estimated_ship_cost (e.g. "USD" for US departure)',
        },
        estimated_replace_cost: {
          type: 'number',
          description: 'Estimated replacement cost at arrival destination',
        },
        replace_currency: {
          type: 'string',
          description: 'Currency code for estimated_replace_cost (e.g. "EUR" for Ireland arrival)',
        },
      },
      required: ['item_name', 'verdict'],
    },
  },
  {
    name: 'update_item_assessment',
    description: 'Update a previously saved item assessment when the user asks to revise a verdict.',
    input_schema: {
      type: 'object' as const,
      properties: {
        assessment_id: { type: 'string', description: 'ID of the assessment to update' },
        verdict: {
          type: 'string',
          enum: ['SHIP', 'CARRY', 'SELL', 'DONATE', 'DISCARD', 'DECIDE_LATER'],
        },
        advice_text: { type: 'string' },
        voltage_compatible: { type: 'boolean' },
        needs_transformer: { type: 'boolean' },
        estimated_ship_cost: { type: 'number' },
        estimated_replace_cost: { type: 'number' },
      },
      required: ['assessment_id'],
    },
  },
  {
    name: 'get_item_assessments',
    description: 'Get all previously saved item assessments for this user.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_cost_summary',
    description: 'Get item counts by verdict and total estimated shipping cost.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'create_box',
    description:
      'Create a new packing box. Use box_type "standard" for regular freight boxes, "checked_luggage" for suitcases, "carryon" for hand luggage, "single_item" for large items shipped individually.',
    input_schema: {
      type: 'object' as const,
      properties: {
        room_name: {
          type: 'string',
          description: 'Room or category name (e.g. "Kitchen", "Bedroom", "Electronics")',
        },
        box_type: {
          type: 'string',
          enum: ['standard', 'checked_luggage', 'carryon', 'single_item'],
          description: 'Type of container',
        },
        size: {
          type: 'string',
          enum: ['XS', 'S', 'M', 'L'],
          description: 'Box size — XS, S, M (default), or L. Only relevant for standard boxes.',
        },
        item_label: {
          type: 'string',
          description: 'Label for single_item boxes — the name of the item',
        },
      },
      required: ['room_name'],
    },
  },
  {
    name: 'add_item_to_box',
    description: 'Add an item to an existing box.',
    input_schema: {
      type: 'object' as const,
      properties: {
        box_id: { type: 'string', description: 'ID of the box to add the item to' },
        item_name: { type: 'string', description: 'Name of the item' },
        item_assessment_id: {
          type: 'string',
          description: 'Assessment ID if the item has a saved assessment',
        },
      },
      required: ['box_id'],
    },
  },
  {
    name: 'update_box_cbm',
    description: 'Update the CBM (cubic metres) volume for a box, typically for single-item boxes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        box_id: { type: 'string' },
        cbm: { type: 'number', description: 'Volume in cubic metres (L × W × H in cm ÷ 1,000,000)' },
      },
      required: ['box_id', 'cbm'],
    },
  },
  {
    name: 'render_assessment_card',
    description:
      'Display a structured assessment card in the chat UI. Call this for EVERY item you assess — one call per item. The card renders visually for the user. Call save_item_assessment separately only after the user confirms.',
    input_schema: {
      type: 'object' as const,
      properties: {
        item: { type: 'string', description: 'Item name' },
        verdict: {
          type: 'string',
          enum: ['SHIP', 'SELL', 'DONATE', 'DISCARD', 'CARRY', 'DECIDE_LATER'],
        },
        confidence: { type: 'number', description: 'Confidence score 0–100' },
        rationale: { type: 'string', description: '1–3 sentences: voltage, cost, restrictions' },
        action: { type: 'string', description: 'One concrete next step' },
        import_note: {
          type: 'string',
          description: 'Biosecurity or customs restriction that affects the verdict. Omit if none.',
        },
        assessment_id: {
          type: 'string',
          description: 'ID of an existing assessment to update (from Previously Assessed Items list). Include this when revising an item to avoid creating a duplicate.',
        },
        item_description: { type: 'string', description: 'Brief description of the item' },
        image_url: { type: 'string', description: 'Storage URL of uploaded item image if from a photo assessment' },
        voltage_compatible: { type: 'boolean', description: 'Whether item works at destination voltage' },
        needs_transformer: { type: 'boolean', description: 'Whether item needs a voltage transformer' },
        estimated_ship_cost_usd: { type: 'number', description: 'Estimated shipping cost in departure currency (SHIP/CARRY only)' },
        currency: { type: 'string', description: 'Currency code for estimated_ship_cost_usd (e.g. "USD")' },
        estimated_replace_cost_usd: { type: 'number', description: 'Estimated replacement cost at arrival destination (SHIP/CARRY only)' },
        replace_currency: { type: 'string', description: 'Currency code for estimated_replace_cost_usd (e.g. "EUR")' },
      },
      required: ['item', 'verdict', 'confidence', 'rationale', 'action'],
    },
  },
  {
    name: 'get_boxes',
    description: 'Get all boxes for the current user, including their items.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'remove_item_from_box',
    description: 'Remove an item from a box. Use this when moving an item to a different box — remove it from the old box, then add it to the new one.',
    input_schema: {
      type: 'object' as const,
      properties: {
        box_id: { type: 'string', description: 'ID of the box the item is currently in' },
        box_item_id: { type: 'string', description: 'ID of the box_item record to remove' },
      },
      required: ['box_id', 'box_item_id'],
    },
  },
  {
    name: 'set_all_boxes_shipped',
    description: 'Mark all boxes as shipped when the user confirms the movers have collected everything.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
]

// ─── Tool executor ──────────────────────────────────────────────────────────

async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  userProfileId: string,
  sessionId: string
): Promise<string> {
  try {
    switch (toolName) {
      case 'save_item_assessment': {
        const record = await saveItemAssessment({
          user_profile_id: userProfileId,
          session_id: sessionId,
          item_name: input.item_name as string,
          verdict: input.verdict as import('@/lib/constants').Verdict,
          advice_text: (input.advice_text as string) ?? null,
          item_description: (input.item_description as string) ?? null,
          image_url: (input.image_url as string) ?? null,
          voltage_compatible: (input.voltage_compatible as boolean) ?? null,
          needs_transformer: (input.needs_transformer as boolean) ?? null,
          estimated_ship_cost: (input.estimated_ship_cost as number) ?? null,
          currency: (input.currency as string) ?? null,
          estimated_replace_cost: (input.estimated_replace_cost as number) ?? null,
          replace_currency: (input.replace_currency as string) ?? null,
        })
        return JSON.stringify({ success: true, assessment_id: record.id })
      }

      case 'update_item_assessment': {
        const { assessment_id, ...changes } = input
        const record = await updateItemAssessment(assessment_id as string, changes)
        return JSON.stringify({ success: true, assessment_id: record.id })
      }

      case 'get_item_assessments': {
        const records = await getItemAssessments(userProfileId)
        return JSON.stringify(records)
      }

      case 'get_cost_summary': {
        const summary = await getCostSummary(userProfileId)
        return JSON.stringify(summary)
      }

      case 'create_box': {
        const sizeMap: Record<string, BoxSize> = {
          XS: 'XS', S: 'S', M: 'M', L: 'L',
          small: 'S', medium: 'M', large: 'L', xlarge: 'XS',
          xs: 'XS', s: 'S', m: 'M', l: 'L',
        }
        const rawSize = input.size as string | undefined
        const mappedSize = rawSize ? sizeMap[rawSize] ?? 'M' : undefined
        const box = await createBox(
          userProfileId,
          input.room_name as string,
          (input.box_type as BoxType) ?? BoxType.STANDARD,
          mappedSize,
          (input.item_label as string) ?? undefined
        )
        return JSON.stringify({ success: true, box_id: box.id, label: box.label })
      }

      case 'add_item_to_box': {
        const item = await addItemToBox(input.box_id as string, {
          itemAssessmentId: (input.item_assessment_id as string) ?? undefined,
          itemName: (input.item_name as string) ?? undefined,
        })
        return JSON.stringify({ success: true, box_item_id: item.id })
      }

      case 'update_box_cbm': {
        await updateBoxCbm(input.box_id as string, input.cbm as number)
        return JSON.stringify({ success: true })
      }

      case 'get_boxes': {
        const boxes = await getBoxes(userProfileId)
        return JSON.stringify(boxes)
      }

      case 'remove_item_from_box': {
        await removeItemFromBox(input.box_id as string, input.box_item_id as string)
        return JSON.stringify({ success: true })
      }

      case 'set_all_boxes_shipped': {
        const count = await setAllBoxesShipped(userProfileId)
        return JSON.stringify({ success: true, boxes_updated: count })
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` })
    }
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : 'Tool execution failed' })
  }
}

// ─── Agentic streaming loop ─────────────────────────────────────────────────

async function runAislingLoop(
  anthropic: Anthropic,
  model: string,
  systemParts: string,
  messages: Anthropic.Messages.MessageParam[],
  controller: ReadableStreamDefaultController,
  userProfileId: string,
  sessionId: string
): Promise<string> {
  const encoder = new TextEncoder()
  let fullAssistantText = ''
  const currentMessages = [...messages]

  // Agentic loop — keeps going while Anthropic returns stop_reason: 'tool_use'
  for (let round = 0; round < 10; round++) {
    const contentBlocks: Anthropic.Messages.MessageParam['content'] = []
    let stopReason: string | null = null

    // Track in-progress blocks during streaming
    let currentText = ''
    let currentToolId = ''
    let currentToolName = ''
    let currentToolJson = ''
    let inToolBlock = false

    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      system: systemParts,
      messages: currentMessages,
      tools: AISLING_TOOLS,
      stream: true,
    })

    for await (const event of response) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'text') {
          currentText = ''
          inToolBlock = false
        } else if (event.content_block.type === 'tool_use') {
          currentToolId = event.content_block.id
          currentToolName = event.content_block.name
          currentToolJson = ''
          inToolBlock = true
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          const chunk = event.delta.text
          currentText += chunk
          fullAssistantText += chunk
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
        } else if (event.delta.type === 'input_json_delta' && inToolBlock) {
          currentToolJson += event.delta.partial_json
        }
      } else if (event.type === 'content_block_stop') {
        if (!inToolBlock && currentText !== '') {
          contentBlocks.push({ type: 'text', text: currentText })
          currentText = ''
        } else if (inToolBlock) {
          let toolInput: Record<string, unknown> = {}
          try {
            toolInput = JSON.parse(currentToolJson)
          } catch {
            // malformed JSON — pass empty input, tool will handle gracefully
          }
          contentBlocks.push({
            type: 'tool_use',
            id: currentToolId,
            name: currentToolName,
            input: toolInput,
          })
          // Emit verbose tool_call event for AI Logic panel
          const toolCallPayload = JSON.stringify({
            __type: 'tool_call',
            name: currentToolName,
            input: toolInput,
          })
          controller.enqueue(encoder.encode(`data: ${toolCallPayload}\n\n`))
          inToolBlock = false
        }
      } else if (event.type === 'message_delta') {
        stopReason = event.delta.stop_reason ?? null
      }
    }

    if (stopReason !== 'tool_use') {
      // Normal end — we're done
      break
    }

    // Add assistant message (text + tool_use blocks) to history
    currentMessages.push({ role: 'assistant', content: contentBlocks })

    // Execute all tool calls and collect results
    const toolUseBlocks = (contentBlocks as Anthropic.Messages.ContentBlock[]).filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use'
    )

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []
    for (const toolUse of toolUseBlocks) {
      if (toolUse.name === 'render_assessment_card') {
        const cardInput = toolUse.input as Record<string, unknown>
        // Send card data directly to the client as a structured SSE event
        const cardPayload = JSON.stringify({ __type: 'card', ...cardInput })
        controller.enqueue(encoder.encode(`data: ${cardPayload}\n\n`))

        // Auto-save assessment with user_confirmed = false.
        // If assessment_id is provided (revision of an existing item), update directly.
        // Otherwise saveItemAssessment handles upsert by item_name.
        let autoSaveResult: { assessment_id?: string } = {}
        try {
          const existingId = cardInput.assessment_id as string | undefined
          let autoSaved: import('@/types/database').ItemAssessment

          if (existingId) {
            autoSaved = await updateItemAssessment(existingId, {
              item_name: cardInput.item as string,
              verdict: cardInput.verdict as import('@/lib/constants').Verdict,
              advice_text: (cardInput.rationale as string) ?? null,
              item_description: (cardInput.item_description as string) ?? null,
              image_url: (cardInput.image_url as string) ?? null,
              voltage_compatible: (cardInput.voltage_compatible as boolean) ?? null,
              needs_transformer: (cardInput.needs_transformer as boolean) ?? null,
              estimated_ship_cost: (cardInput.estimated_ship_cost_usd as number) ?? null,
              currency: (cardInput.currency as string) ?? null,
              estimated_replace_cost: (cardInput.estimated_replace_cost_usd as number) ?? null,
              replace_currency: (cardInput.replace_currency as string) ?? null,
              user_confirmed: false,
            }, userProfileId)
          } else {
            autoSaved = await saveItemAssessment({
              user_profile_id: userProfileId,
              session_id: sessionId,
              item_name: cardInput.item as string,
              verdict: cardInput.verdict as import('@/lib/constants').Verdict,
              advice_text: (cardInput.rationale as string) ?? null,
              item_description: (cardInput.item_description as string) ?? null,
              image_url: (cardInput.image_url as string) ?? null,
              voltage_compatible: (cardInput.voltage_compatible as boolean) ?? null,
              needs_transformer: (cardInput.needs_transformer as boolean) ?? null,
              estimated_ship_cost: (cardInput.estimated_ship_cost_usd as number) ?? null,
              currency: (cardInput.currency as string) ?? null,
              estimated_replace_cost: (cardInput.estimated_replace_cost_usd as number) ?? null,
              replace_currency: (cardInput.replace_currency as string) ?? null,
              user_confirmed: false,
            })
          }
          autoSaveResult = { assessment_id: autoSaved.id }
        } catch (saveErr) {
          console.error('[chat] auto-save assessment failed:', saveErr)
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({ success: true, ...autoSaveResult }),
        })
      } else {
        const result = await executeTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          userProfileId,
          sessionId
        )
        // Emit verbose tool_result event for AI Logic panel
        let parsedResult: unknown = result
        try {
          parsedResult = JSON.parse(result)
        } catch {
          // keep raw string
        }
        const toolResultPayload = JSON.stringify({
          __type: 'tool_result',
          name: toolUse.name,
          result: parsedResult,
        })
        controller.enqueue(encoder.encode(`data: ${toolResultPayload}\n\n`))
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result,
        })
      }
    }

    // Feed tool results back in and continue streaming
    currentMessages.push({ role: 'user', content: toolResults })
  }

  return fullAssistantText
}

// ─── Route handler ─────────────────────────────────────────────────────────

interface ChatBody {
  message: string
  image_url?: string
  image_urls?: string[]
}

export async function POST(req: NextRequest) {
  const { user, profile: authProfile } = await getAuthenticatedProfile()
  if (!user || !authProfile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const session = await findOrCreateSession(authProfile.id)
  const sessionId = session.id

  let body: ChatBody
  try {
    body = (await req.json()) as ChatBody
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { message, image_url, image_urls } = body
  const allImageUrls = [
    ...(image_urls ?? []),
    ...(image_url ? [image_url] : []),
  ].filter(Boolean)

  if (typeof message !== 'string') {
    return Response.json({ ok: false, error: 'message must be a string' }, { status: 400 })
  }
  if (!message && allImageUrls.length === 0) {
    return Response.json({ ok: false, error: 'message or image_url is required' }, { status: 400 })
  }

  try {
    const profile = authProfile

    const cliMode = useCliMode()

    const apiKey = cliMode
      ? '' // CLI mode doesn't need an API key
      : getAnthropicApiKey() || profile.anthropic_api_key || ''

    if (!cliMode && !apiKey) {
      return Response.json(
        {
          ok: false,
          error:
            'No Anthropic API key configured. Add your key in account settings or set ANTHROPIC_API_KEY in your environment.',
        },
        { status: 402 }
      )
    }

    const aislingPersona = readAislingPersona()

    const departureCountry = profile.departure_country as string
    const arrivalCountry = profile.arrival_country as string
    const onwardCountry = profile.onward_country as string | null

    const departureCode = departureCountry ? countryToModuleCode(departureCountry) : ''
    const arrivalCode = arrivalCountry ? countryToModuleCode(arrivalCountry) : ''
    const onwardCode = onwardCountry ? countryToModuleCode(onwardCountry) : ''

    const departureModule = departureCode
      ? readKnowledgeFile(`countries/${departureCode}-departure.md`)
      : ''
    const arrivalModule = arrivalCode
      ? readKnowledgeFile(`countries/${arrivalCode}-arrival.md`)
      : ''
    const onwardModule = onwardCode
      ? readKnowledgeFile(`countries/${onwardCode}-arrival.md`)
      : ''

    const voltageModule = readKnowledgeFile('voltage.md')
    const shippingEconModule = readKnowledgeFile('shipping-economics.md')

    const departureCurrency = departureCountry ? countryToCurrency(departureCountry) : 'USD'
    const arrivalCurrency = arrivalCountry ? countryToCurrency(arrivalCountry) : 'EUR'

    const profileBlock = profile
      ? `## User Profile

Departure country: ${profile.departure_country}
Arrival country: ${profile.arrival_country}
Onward country: ${profile.onward_country ?? 'None'}
Onward timeline: ${profile.onward_timeline ?? 'N/A'}
Equipment: ${JSON.stringify(profile.equipment ?? {})}
User profile ID: ${profile.id}
Session ID: ${sessionId}
Departure currency: ${departureCurrency}
Arrival currency: ${arrivalCurrency}

When calling save_item_assessment, always set currency="${departureCurrency}" and replace_currency="${arrivalCurrency}".
`
      : ''

    // ── Load previously assessed items for context ─────────────────────────────
    const profileId = session.user_profile_id
    let assessmentContext = ''
    try {
      const assessments = await getItemAssessments(profileId)
      if (assessments.length > 0) {
        const lines = assessments.map(
          (a) => `- ${a.item_name}: ${a.verdict} [id: ${a.id}]${a.advice_text ? ` (${a.advice_text.slice(0, 80)})` : ''}`
        )
        assessmentContext = `## Previously Assessed Items (${assessments.length} total)\n\n${lines.join('\n')}\n\nDo not re-assess these items unless the user explicitly asks. You may reference previous decisions. When re-assessing an item, include its assessment_id from the list above in your render_assessment_card call to update the existing record.`
      }
    } catch {
      // Non-fatal
    }

    const systemParts = [
      aislingPersona,
      profileBlock,
      departureModule ? `## Departure Country Module\n\n${departureModule}` : '',
      arrivalModule ? `## Arrival Country Module\n\n${arrivalModule}` : '',
      onwardModule ? `## Onward Country Module\n\n${onwardModule}` : '',
      voltageModule ? `## Voltage Skill\n\n${voltageModule}` : '',
      shippingEconModule ? `## Shipping Economics Skill\n\n${shippingEconModule}` : '',
      assessmentContext,
    ]
      .filter(Boolean)
      .join('\n\n---\n\n')

    // ── Build message history ─────────────────────────────────────────────────

    // ── Detect opening / welcome-back trigger ────────────────────────────────
    const isOpeningTrigger = message === '__opening__'
    const isWelcomeBack = message === '__welcome_back__'

    const history = await getMessages(sessionId)

    // For welcome-back, skip conversation history — the injected summary data
    // (verdict counts + box counts) is the source of truth. Passing full history
    // causes Aisling to echo prior turns as text in her welcome message.
    const anthropicMessages: Anthropic.Messages.MessageParam[] = isWelcomeBack
      ? []
      : history
          .filter((m) => typeof m.content === 'string' && m.content.trim().length > 0)
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }))

    let effectiveMessage: string
    if (isOpeningTrigger) {
      effectiveMessage = '[SYSTEM: This is the start of a new session. Greet the user warmly. Confirm their move details (departure, arrival, and onward country if set). Invite them to start going through their things.]'
    } else if (isWelcomeBack) {
      let summaryText = ''
      try {
        const costData = await getCostSummary(profileId)
        const counts = costData.counts_by_verdict
        const total = Object.values(counts).reduce((s, n) => s + n, 0)
        const ship = counts['SHIP'] ?? 0
        const sell = counts['SELL'] ?? 0
        const decideLater = counts['DECIDE_LATER'] ?? 0
        summaryText = `They have ${total} items assessed — ${ship} to ship, ${sell} to sell, ${decideLater} still to decide on. Estimated shipping cost: ${costData.currency} ${costData.total_estimated_ship_cost.toLocaleString()}.`
      } catch {
        summaryText = 'They have previously assessed items.'
      }
      let boxSummaryText = ''
      try {
        const boxes = await getBoxes(profileId)
        if (boxes.length > 0) {
          const boxDescriptions = boxes.map((b) => `${b.label}: ${b.items.length} items, status ${b.status}`).join('; ')
          boxSummaryText = ` Boxes: ${boxDescriptions}.`
        }
      } catch {
        // Non-critical — Aisling can still generate a welcome without box details
      }
      let decisionsSummaryText = ''
      try {
        const unconfirmed = await getItemAssessments(profileId, { user_confirmed: false })
        if (unconfirmed.length > 0) {
          const itemNames = unconfirmed.map((a) => a.item_name).join(', ')
          decisionsSummaryText = ` Pending decisions: ${unconfirmed.length} item(s) have been assessed but not yet confirmed by the user: ${itemNames}. Mention these and encourage the user to review and confirm them.`
        }
      } catch {
        // Non-critical
      }
      effectiveMessage = `[SYSTEM: The user is returning to a previous session. ${summaryText}${boxSummaryText}${decisionsSummaryText} Generate a warm, specific welcome-back message summarising their progress with real numbers. Use the box item counts provided above — do not rely on previous conversation history for counts, as they may be outdated. Invite them to continue where they left off — perhaps ask what room or category they want to tackle next.]`
    } else {
      effectiveMessage = message
    }

    // Build current user message with optional images
    const userContent: Anthropic.Messages.ContentBlockParam[] = []
    // Fetch images server-side (the server can reach local Supabase)
    // CLI mode: save to temp files for the CLI's Read tool (it can't access network URLs)
    // SDK mode: send as base64 content blocks to the Anthropic API
    const cliImagePaths: string[] = []

    for (const url of allImageUrls) {
      try {
        const imgRes = await fetch(url)
        if (!imgRes.ok) {
          console.error(`[chat] Failed to fetch image ${url}: ${imgRes.status}`)
          continue
        }
        const imgBuffer = Buffer.from(await imgRes.arrayBuffer())

        if (cliMode) {
          const tmpPath = path.join('/tmp', `aisling-img-${Date.now()}-${Math.random().toString(36).slice(2)}.webp`)
          fs.writeFileSync(tmpPath, imgBuffer)
          cliImagePaths.push(tmpPath)
        } else {
          const imgBase64 = imgBuffer.toString('base64')
          const imgMediaType = (imgRes.headers.get('content-type') || 'image/webp') as
            | 'image/jpeg'
            | 'image/png'
            | 'image/gif'
            | 'image/webp'
          userContent.push({
            type: 'image',
            source: { type: 'base64', media_type: imgMediaType, data: imgBase64 },
          } as Anthropic.Messages.ImageBlockParam)
        }
      } catch (imgErr) {
        console.error(`[chat] Error fetching image ${url}:`, imgErr)
      }
    }

    if (effectiveMessage) userContent.push({ type: 'text', text: effectiveMessage })

    anthropicMessages.push({ role: 'user', content: userContent })

    // ── Stream ────────────────────────────────────────────────────────────────

    const model = process.env.MODEL_AISLING ?? 'claude-sonnet-4-6'

    const userMessageId = `msg_${Date.now()}_user`
    const assistantMessageId = `msg_${Date.now()}_asst`
    const now = new Date().toISOString()
    const userProfileId = session.user_profile_id

    // ── Tool executor for CLI mode (handles render_assessment_card auto-save) ──
    const cliToolExecutor = async (
      toolName: string,
      toolInput: Record<string, unknown>
    ): Promise<string> => {
      if (toolName === 'render_assessment_card') {
        const cardInput = toolInput
        let autoSaveResult: { assessment_id?: string } = {}
        try {
          const existingId = cardInput.assessment_id as string | undefined
          let autoSaved: import('@/types/database').ItemAssessment

          if (existingId) {
            autoSaved = await updateItemAssessment(existingId, {
              item_name: cardInput.item as string,
              verdict: cardInput.verdict as import('@/lib/constants').Verdict,
              advice_text: (cardInput.rationale as string) ?? null,
              item_description: (cardInput.item_description as string) ?? null,
              image_url: (cardInput.image_url as string) ?? null,
              voltage_compatible: (cardInput.voltage_compatible as boolean) ?? null,
              needs_transformer: (cardInput.needs_transformer as boolean) ?? null,
              estimated_ship_cost: (cardInput.estimated_ship_cost_usd as number) ?? null,
              currency: (cardInput.currency as string) ?? null,
              estimated_replace_cost: (cardInput.estimated_replace_cost_usd as number) ?? null,
              replace_currency: (cardInput.replace_currency as string) ?? null,
              user_confirmed: false,
            }, userProfileId)
          } else {
            autoSaved = await saveItemAssessment({
              user_profile_id: userProfileId,
              session_id: sessionId,
              item_name: cardInput.item as string,
              verdict: cardInput.verdict as import('@/lib/constants').Verdict,
              advice_text: (cardInput.rationale as string) ?? null,
              item_description: (cardInput.item_description as string) ?? null,
              image_url: (cardInput.image_url as string) ?? null,
              voltage_compatible: (cardInput.voltage_compatible as boolean) ?? null,
              needs_transformer: (cardInput.needs_transformer as boolean) ?? null,
              estimated_ship_cost: (cardInput.estimated_ship_cost_usd as number) ?? null,
              currency: (cardInput.currency as string) ?? null,
              estimated_replace_cost: (cardInput.estimated_replace_cost_usd as number) ?? null,
              replace_currency: (cardInput.replace_currency as string) ?? null,
              user_confirmed: false,
            })
          }
          autoSaveResult = { assessment_id: autoSaved.id }
        } catch (saveErr) {
          console.error('[chat] auto-save assessment failed:', saveErr)
        }
        return JSON.stringify({ success: true, ...autoSaveResult })
      }
      return executeTool(toolName, toolInput, userProfileId, sessionId)
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let assistantText: string

          if (cliMode) {
            // ── CLI mode: use claude subprocess ──
            const cliMessages = anthropicMessages.map((m) => ({
              role: m.role,
              content:
                typeof m.content === 'string'
                  ? m.content
                  : Array.isArray(m.content)
                    ? m.content
                        .filter((b) => 'text' in b)
                        .map((b) => (b as { text: string }).text)
                        .join('\n')
                    : '',
            }))

            // If there are images, append local file paths to the last user message
            // so the CLI's Read tool can view them (CLI can't access network URLs)
            if (cliImagePaths.length > 0 && cliMessages.length > 0) {
              const lastMsg = cliMessages[cliMessages.length - 1]
              if (lastMsg && lastMsg.role === 'user') {
                const imageList = cliImagePaths.map(
                  (p, i) => `[Image ${i + 1}: ${p}]`
                ).join('\n')
                lastMsg.content = `${lastMsg.content}\n\nThe user has uploaded ${cliImagePaths.length} photo(s). Read each image file path below to see what items are shown, then assess each item you can identify.\n${imageList}`
              }
            }

            assistantText = await runCliAgentLoop(
              systemParts,
              cliMessages,
              AISLING_TOOLS as unknown as ToolDefinition[],
              model,
              controller,
              cliToolExecutor,
              cliImagePaths.length > 0 ? ['Read'] : undefined
            )

            // Clean up temp image files
            for (const tmpPath of cliImagePaths) {
              try { fs.unlinkSync(tmpPath) } catch { /* ignore */ }
            }
          } else {
            // ── SDK mode: direct Anthropic API ──
            const anthropic = apiKey.startsWith('sk-ant-oat')
              ? new Anthropic({ authToken: apiKey })
              : new Anthropic({ apiKey })

            assistantText = await runAislingLoop(
              anthropic,
              model,
              systemParts,
              anthropicMessages,
              controller,
              userProfileId,
              sessionId
            )
          }

          // Persist messages BEFORE closing the stream so that any subsequent
          // /api/session call sees has_history: true and does not fire __welcome_back__
          // (fixes MF-ISSUE-011: chat resets after image upload)

          // Don't persist internal triggers as user messages
          if (!isOpeningTrigger && !isWelcomeBack) {
            const persistedUserContent =
              message || `[${allImageUrls.length} image${allImageUrls.length > 1 ? 's' : ''}]`
            await appendMessage(sessionId, {
              id: userMessageId,
              role: 'user',
              content: persistedUserContent,
              created_at: now,
            })
          }
          await appendMessage(sessionId, {
            id: assistantMessageId,
            role: 'assistant',
            content: assistantText,
            created_at: new Date().toISOString(),
          })

          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Streaming error'
          const isAuthError =
            errMsg.includes('authentication_error') ||
            errMsg.includes('401') ||
            errMsg.includes('invalid x-api-key') ||
            errMsg.includes('invalid api key')
          if (isAuthError && !cliMode) {
            refreshAnthropicApiKey()
          }
          const retryHint = isAuthError && !cliMode
            ? ' (API key refreshed from keychain — please retry your message)'
            : ''
          controller.enqueue(
            new TextEncoder().encode(
              `data: {"error":"${errMsg.replace(/"/g, '\\"')}${retryHint}"}\n\n`
            )
          )
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[chat] pre-stream error:', err)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
