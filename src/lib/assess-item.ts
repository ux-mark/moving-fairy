import { getItemAssessments, updateItemAssessment } from '@/mcp'
import { getUserProfile } from '@/mcp'
import { ProcessingStatus, Verdict } from '@/lib/constants'
import { composeAssessmentPrompt } from '@/lib/aisling-prompt'
import { callCli, useCliMode, type ToolDefinition } from '@/lib/claude-cli'
import { getAnthropicApiKey, refreshAnthropicApiKey } from '@/lib/dev-api-key'
import type { UserProfile } from '@/types/database'
import { writeFile, unlink } from 'fs/promises'

// ─── render_assessment_card tool schema ──────────────────────────────────────

const RENDER_ASSESSMENT_CARD_TOOL: ToolDefinition = {
  name: 'render_assessment_card',
  description:
    'Display a structured assessment card. Call this for EVERY item you assess — one call per item.',
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
        description:
          'Biosecurity or customs restriction that affects the verdict. Omit if none.',
      },
      item_description: {
        type: 'string',
        description: 'Brief description of the item',
      },
      voltage_compatible: {
        type: 'boolean',
        description: 'Whether item works at destination voltage',
      },
      needs_transformer: {
        type: 'boolean',
        description: 'Whether item needs a voltage transformer',
      },
      estimated_ship_cost_usd: {
        type: 'number',
        description:
          'Estimated shipping cost in departure currency (SHIP/CARRY only)',
      },
      currency: {
        type: 'string',
        description: 'Currency code for estimated_ship_cost_usd (e.g. "USD")',
      },
      estimated_replace_cost_usd: {
        type: 'number',
        description:
          'Estimated replacement cost at arrival destination (SHIP/CARRY only)',
      },
      replace_currency: {
        type: 'string',
        description:
          'Currency code for estimated_replace_cost_usd (e.g. "EUR")',
      },
    },
    required: ['item', 'verdict', 'confidence', 'rationale', 'action'],
  },
}

// ─── Tool call shape returned by the LLM ─────────────────────────────────────

interface AssessmentCardInput {
  item: string
  verdict: string
  confidence: number
  rationale: string
  action: string
  import_note?: string
  item_description?: string
  voltage_compatible?: boolean
  needs_transformer?: boolean
  estimated_ship_cost_usd?: number
  currency?: string
  estimated_replace_cost_usd?: number
  replace_currency?: string
}

// ─── API key resolution ───────────────────────────────────────────────────────

function getApiKey(profile: UserProfile): string {
  if (process.env.NODE_ENV === 'development') {
    return getAnthropicApiKey()
  }
  return profile.anthropic_api_key ?? process.env.ANTHROPIC_API_KEY ?? ''
}

// ─── CLI mode helpers ─────────────────────────────────────────────────────────

/**
 * Build the tool instructions preamble for CLI mode.
 * Replicates the pattern in claude-cli.ts buildToolInstructions().
 */
function buildCliToolInstructions(tools: ToolDefinition[]): string {
  let instructions =
    '\n\n--- TOOL USE INSTRUCTIONS (MANDATORY) ---\n' +
    'CRITICAL: You MUST call tools using <tool_call> XML tags. NEVER output tool ' +
    'data as plain text, markdown tables, or inline descriptions.\n\n' +
    'Format — wrap a JSON object in <tool_call> tags:\n\n' +
    '<tool_call>\n' +
    '{"name": "tool_name", "input": {"param1": "value1"}}\n' +
    '</tool_call>\n\n' +
    'You may output multiple <tool_call> blocks. After outputting tool calls, ' +
    'STOP and wait for the results.\n\n' +
    'Available tools:\n\n'

  for (const t of tools) {
    instructions += `### ${t.name}\n`
    instructions += `${t.description}\n`
    const required = t.input_schema.required ?? []
    const props = t.input_schema.properties ?? {}
    if (Object.keys(props).length > 0) {
      instructions += 'Parameters:\n'
      for (const [pname, pdef] of Object.entries(props)) {
        const def = pdef as Record<string, unknown>
        const reqMarker = required.includes(pname) ? ' (required)' : ''
        const desc =
          (def.description as string) ?? (def.type as string) ?? 'any'
        instructions += `  - ${pname}: ${desc}${reqMarker}\n`
      }
    }
    instructions += '\n'
  }

  instructions += '--- END TOOL USE INSTRUCTIONS ---\n'
  return instructions
}

/**
 * Extract the first render_assessment_card tool call from CLI response text.
 * Uses the same <tool_call> XML regex as extractToolCalls() in claude-cli.ts.
 */
function extractAssessmentCardFromCli(
  responseText: string
): AssessmentCardInput | null {
  const pattern = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g
  let match

  while ((match = pattern.exec(responseText)) !== null) {
    try {
      const raw = match[1] ?? ''
      const tc = JSON.parse(raw.trim()) as {
        name: string
        input?: Record<string, unknown>
      }
      if (tc.name === 'render_assessment_card' && tc.input) {
        return tc.input as unknown as AssessmentCardInput
      }
    } catch {
      console.warn(
        '[assess-item] Failed to parse tool call JSON:',
        match[1]?.slice(0, 100)
      )
    }
  }

  return null
}

// ─── SDK mode helpers ─────────────────────────────────────────────────────────

/**
 * Download an image from a URL and return base64-encoded data + media type.
 */
async function fetchImageAsBase64(
  imageUrl: string
): Promise<{ base64: string; mediaType: string }> {
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch image: ${response.status} ${response.statusText}`
    )
  }

  const contentType = response.headers.get('content-type') ?? 'image/webp'
  // Normalise — Supabase Storage serves WebP but may return a generic MIME type
  const mediaType = contentType.startsWith('image/') ? contentType : 'image/webp'

  const buffer = await response.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  return { base64, mediaType }
}

/**
 * Call the Anthropic SDK with tool use, returning the parsed assessment card.
 * Retries once on 401 (refreshes API key from keychain in dev).
 */
async function callSdkWithRetry(
  systemPrompt: string,
  userContent: unknown[],
  profile: UserProfile,
  model: string
): Promise<AssessmentCardInput | null> {
  // Dynamic import so the SDK is only loaded when needed
  const Anthropic = (await import('@anthropic-ai/sdk')).default

  async function attempt(apiKey: string): Promise<AssessmentCardInput | null> {
    const client = new Anthropic({ apiKey })

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [RENDER_ASSESSMENT_CARD_TOOL as any],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ role: 'user', content: userContent as any }],
    })

    // Find the render_assessment_card tool_use block
    for (const block of response.content) {
      if (
        block.type === 'tool_use' &&
        block.name === 'render_assessment_card'
      ) {
        return block.input as unknown as AssessmentCardInput
      }
    }

    return null
  }

  const apiKey = getApiKey(profile)

  try {
    return await attempt(apiKey)
  } catch (err) {
    // Retry once on 401 in development (refresh keychain token)
    if (
      process.env.NODE_ENV === 'development' &&
      err instanceof Error &&
      err.message.includes('401')
    ) {
      console.warn('[assess-item] Got 401 from SDK — refreshing API key and retrying')
      const freshKey = refreshAnthropicApiKey()
      return await attempt(freshKey)
    }
    throw err
  }
}

// ─── Main assessItem function ─────────────────────────────────────────────────

/**
 * assessItem — background assessment runner
 *
 * Fetches the item and profile, calls the LLM (Aisling) to produce an
 * assessment using the render_assessment_card tool, and writes the result
 * back to item_assessment.
 *
 * Mode selection:
 * - CLI mode (dev default): calls the claude CLI subprocess via callCli().
 *   For images: downloads to a temp file, instructs the model to use the
 *   Read tool (vision-capable) to view it. No API key needed.
 * - SDK mode (prod + FORCE_SDK): calls the Anthropic SDK directly.
 */
export async function assessItem(itemId: string, profileId: string): Promise<void> {
  try {
    // 1. Fetch item and verify it belongs to this profile
    const items = await getItemAssessments(profileId)
    const item = items.find((a) => a.id === itemId)
    if (!item) {
      console.error(`[assess-item] Item ${itemId} not found for profile ${profileId}`)
      return
    }

    // 2. Load user profile for route context
    const profile = await getUserProfile(profileId)
    if (!profile) {
      console.error(`[assess-item] Profile ${profileId} not found`)
      await updateItemAssessment(itemId, { processing_status: ProcessingStatus.FAILED }, profileId)
      return
    }

    const model = process.env.MODEL_AISLING ?? 'claude-sonnet-4-6'

    const hasImage = Boolean(item.image_url)
    const itemHasTextName =
      item.item_name &&
      item.item_name !== 'Untitled' &&
      item.item_name !== 'Untitled item' &&
      item.item_name.trim() !== ''

    // 3. Determine LLM mode
    // CLI mode (dev): uses the `claude` CLI subprocess — no API key needed.
    //   For images: downloads to a temp file, tells the CLI to Read it (vision).
    // SDK mode (prod / FORCE_SDK): calls the Anthropic SDK directly with tool_use.
    const useSdk = !useCliMode()

    console.log(
      `[assess-item] Assessing item "${item.item_name}" (${itemId}) ` +
        `| route: ${profile.departure_country} → ${profile.arrival_country}` +
        `${profile.onward_country ? ` → ${profile.onward_country}` : ''}` +
        ` | has_image: ${hasImage} | mode: ${useSdk ? 'sdk' : 'cli'}`
    )

    // 4. Compose system prompt via Aisling's prompt module
    const systemPrompt = composeAssessmentPrompt(profile)

    let card: AssessmentCardInput | null = null

    if (useSdk) {
      // ── SDK path (production) ──────────────────────────────────────────────
      // Build user message content — include image if available
      const userContent: unknown[] = []

      if (hasImage && item.image_url) {
        try {
          const { base64, mediaType } = await fetchImageAsBase64(item.image_url)
          userContent.push({
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          })
        } catch (imgErr) {
          console.warn(
            `[assess-item] Could not fetch image for item ${itemId}, proceeding text-only:`,
            imgErr
          )
        }
      }

      // Add text prompt
      if (itemHasTextName) {
        let textPrompt = `Assess this item: ${item.item_name}`
        if (item.item_description) {
          textPrompt += `\n\n${item.item_description}`
        }
        userContent.push({ type: 'text', text: textPrompt })
      } else if (userContent.length > 0) {
        // Image-only — ask Aisling to identify and assess
        userContent.push({
          type: 'text',
          text: 'Identify the item in this photo and assess it.',
        })
      } else {
        // No image, no text name — nothing to assess
        console.error(
          `[assess-item] Item ${itemId} has neither a name nor an image — cannot assess`
        )
        await updateItemAssessment(
          itemId,
          { processing_status: ProcessingStatus.FAILED },
          profileId
        )
        return
      }

      card = await callSdkWithRetry(systemPrompt, userContent, profile, model)
    } else {
      // ── CLI path (dev) ─────────────────────────────────────────────────────
      // The CLI subprocess uses the developer's Claude subscription — no API key.
      // For images: download to a temp file, instruct the model to use the
      // Read tool (which supports vision) to view it.
      const toolInstructions = buildCliToolInstructions([RENDER_ASSESSMENT_CARD_TOOL])
      const fullSystemPrompt = toolInstructions + '\n\n' + systemPrompt

      let userPrompt: string
      let imageTmpPath: string | null = null

      if (hasImage && item.image_url) {
        // Download image to temp file so the CLI's Read tool can view it
        imageTmpPath = `/tmp/assess-${itemId}.webp`
        try {
          const imgResponse = await fetch(item.image_url)
          if (!imgResponse.ok) throw new Error(`HTTP ${imgResponse.status}`)
          const imgBuffer = Buffer.from(await imgResponse.arrayBuffer())
          await writeFile(imageTmpPath, imgBuffer)
          console.log(`[assess-item] Saved image for CLI to ${imageTmpPath} (${imgBuffer.length} bytes)`)
        } catch (imgErr) {
          console.warn(`[assess-item] Could not download image for item ${itemId}:`, imgErr)
          imageTmpPath = null
        }
      }

      if (imageTmpPath && itemHasTextName) {
        // Has both image and text name
        userPrompt =
          `First, use the Read tool to view the image at ${imageTmpPath} — it shows the item.\n\n` +
          `The item is called: ${item.item_name}` +
          (item.item_description ? `\n\n${item.item_description}` : '') +
          '\n\nBased on both the image and the name, assess this item.'
      } else if (imageTmpPath) {
        // Image only (no text name)
        userPrompt =
          `Use the Read tool to view the image at ${imageTmpPath}.\n\n` +
          'Identify the item in the photo and assess it.'
      } else if (itemHasTextName) {
        // Text only (no image, or image download failed)
        userPrompt = `Assess this item: ${item.item_name}`
        if (item.item_description) {
          userPrompt += `\n\n${item.item_description}`
        }
      } else {
        // No image, no text name — nothing to assess
        console.error(
          `[assess-item] Item ${itemId} has neither a name nor an image — cannot assess`
        )
        await updateItemAssessment(
          itemId,
          { processing_status: ProcessingStatus.FAILED },
          profileId
        )
        return
      }

      const cliOptions = imageTmpPath ? { addDirs: ['/tmp'] } : undefined
      const responseText = await callCli(userPrompt, fullSystemPrompt, model, cliOptions)
      card = extractAssessmentCardFromCli(responseText)

      // Clean up temp image file
      if (imageTmpPath) {
        unlink(imageTmpPath).catch(() => {})
      }
    }

    // 5. Parse and persist the assessment card
    if (card) {
      // Build advice_text from rationale + action + import_note
      let adviceText = card.rationale
      if (card.action) adviceText += `\n${card.action}`
      if (card.import_note) adviceText += `\n\u26a0\ufe0f ${card.import_note}`

      // Normalise verdict — LLM may return legacy values or variants
      const rawVerdict = card.verdict.replace(/\s+/g, '_').toUpperCase()
      const verdict: Verdict = (rawVerdict === 'DECIDE_LATER' || rawVerdict === 'DECIDE LATER')
        ? Verdict.REVISIT
        : (rawVerdict as Verdict)

      await updateItemAssessment(
        itemId,
        {
          item_name: card.item ?? item.item_name,
          verdict,
          advice_text: adviceText,
          confidence: card.confidence ?? null,
          needs_clarification: (card.confidence ?? 100) < 60,
          voltage_compatible: card.voltage_compatible ?? null,
          needs_transformer: card.needs_transformer ?? null,
          estimated_ship_cost: card.estimated_ship_cost_usd ?? null,
          currency: card.currency ?? null,
          estimated_replace_cost: card.estimated_replace_cost_usd ?? null,
          replace_currency: card.replace_currency ?? null,
          item_description: card.item_description ?? item.item_description ?? null,
          processing_status: ProcessingStatus.COMPLETED,
        },
        profileId
      )

      console.log(
        `[assess-item] Completed item ${itemId}: verdict=${verdict}, confidence=${card.confidence}`
      )
    } else {
      // LLM responded but did not call render_assessment_card
      console.warn(
        `[assess-item] LLM did not call render_assessment_card for item ${itemId} — marking needs_clarification`
      )
      await updateItemAssessment(
        itemId,
        {
          processing_status: ProcessingStatus.COMPLETED,
          verdict: Verdict.REVISIT,
          advice_text:
            'Assessment could not be completed automatically. Please add more details about this item.',
          needs_clarification: true,
          confidence: null,
        },
        profileId
      )
    }
  } catch (err) {
    console.error(`[assess-item] Unexpected error for item ${itemId}:`, err)
    try {
      await updateItemAssessment(itemId, { processing_status: ProcessingStatus.FAILED }, profileId)
    } catch (updateErr) {
      console.error(
        `[assess-item] Failed to set error status for item ${itemId}:`,
        updateErr
      )
    }
  }
}
