import { addCategory, getItemAssessments, getSettings, updateItemAssessment } from '@/mcp'
import { getUserProfile } from '@/mcp'
import {
  BiosecurityCategory,
  BiosecurityFlag,
  ProcessingStatus,
  Verdict,
} from '@/lib/constants'
import { composeAssessmentPrompt } from '@/lib/aisling-prompt'
import { buildToolInstructions, callCli } from '@/lib/claude-cli'
import {
  getAislingModel,
  getExecutorMode,
  withSdk401Retry,
  createAnthropicClient,
} from '@/lib/ai/executor'
import {
  cleanupTmpImage,
  downloadImageToTmp,
  fetchSdkImageBlock,
} from '@/lib/ai/image-attachment'
import { RENDER_ASSESSMENT_CARD_TOOL, type AssessmentCardInput } from '@/lib/ai/tools'
import type { UserProfile } from '@/types/database'

// ─── CLI mode helpers ─────────────────────────────────────────────────────────

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
 * Call the Anthropic SDK with tool use, returning the parsed assessment card.
 * Retries once on 401 (refreshes API key from keychain in dev).
 */
async function callSdkWithRetry(
  systemPrompt: string,
  userContent: unknown[],
  profile: UserProfile,
  model: string
): Promise<AssessmentCardInput | null> {
  return withSdk401Retry(profile, 'assess-item', async (apiKey) => {
    const client = await createAnthropicClient(apiKey)

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
  })
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

    const model = getAislingModel()

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
    const useSdk = getExecutorMode() === 'sdk'

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
          userContent.push(await fetchSdkImageBlock(item.image_url))
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
      const toolInstructions = buildToolInstructions([RENDER_ASSESSMENT_CARD_TOOL])
      const fullSystemPrompt = toolInstructions + '\n\n' + systemPrompt

      let userPrompt: string
      let imageTmpPath: string | null = null

      if (hasImage && item.image_url) {
        // Download image to temp file so the CLI's Read tool can view it
        try {
          imageTmpPath = await downloadImageToTmp(
            item.image_url,
            `/tmp/assess-${itemId}.webp`,
            'assess-item'
          )
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
        cleanupTmpImage(imageTmpPath)
      }
    }

    // 5. Parse and persist the assessment card
    if (card) {
      // Build advice_text from rationale + action + biosec/import notes
      let adviceText = card.rationale
      if (card.action) adviceText += `\n${card.action}`
      if (card.biosecurity_note) adviceText += `\n\u26a0\ufe0f ${card.biosecurity_note}`
      if (card.import_note) adviceText += `\n\u26a0\ufe0f ${card.import_note}`

      // Normalise verdict — LLM may return legacy values or variants
      const rawVerdict = card.verdict.replace(/\s+/g, '_').toUpperCase()
      const verdict: Verdict = (rawVerdict === 'DECIDE_LATER' || rawVerdict === 'DECIDE LATER')
        ? Verdict.REVISIT
        : (rawVerdict as Verdict)

      // Normalise biosecurity fields — validate against enums, drop unknown
      // values rather than write something the CHECK constraint would reject.
      const validFlags = Object.values(BiosecurityFlag) as string[]
      const validCategories = Object.values(BiosecurityCategory) as string[]
      const biosecurityFlag: BiosecurityFlag | null =
        card.biosecurity_flag && validFlags.includes(card.biosecurity_flag)
          ? (card.biosecurity_flag as BiosecurityFlag)
          : null
      const biosecurityCategory: BiosecurityCategory | null =
        card.biosecurity_category && validCategories.includes(card.biosecurity_category)
          ? (card.biosecurity_category as BiosecurityCategory)
          : null

      const normalisedCategory = card.category?.trim() ? card.category.trim() : null

      // Care is accepted for any item — the agent gates on biosec category
      // in the prompt. Treat an empty object as null so we don't write `{}`.
      const normalisedCare =
        card.care && typeof card.care === 'object' && Object.keys(card.care).length > 0
          ? card.care
          : null

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
          biosecurity_flag: biosecurityFlag,
          biosecurity_category: biosecurityCategory,
          biosecurity_note: card.biosecurity_note ?? null,
          category: normalisedCategory,
          care: normalisedCare,
          processing_status: ProcessingStatus.COMPLETED,
        },
        profileId
      )

      // If Aisling proposed a category that isn't on the seller's master list
      // yet, merge it in. Best-effort — a failure here must not fail the
      // assessment write that already succeeded.
      if (normalisedCategory) {
        try {
          const settings = await getSettings(profileId)
          const existing = settings.categories ?? []
          const alreadyPresent = existing.some(
            (c) => c.toLowerCase() === normalisedCategory.toLowerCase(),
          )
          if (!alreadyPresent) {
            await addCategory(profileId, normalisedCategory)
          }
        } catch (mergeErr) {
          console.warn(
            `[assess-item] Could not merge category "${normalisedCategory}" into seller settings for ${profileId}:`,
            mergeErr,
          )
        }
      }

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

/**
 * Assess many items, a few at a time, so a "value my inventory" sweep doesn't
 * fire dozens of LLM calls at once. Fire-and-forget from the API route — each
 * assessItem updates its own processing_status, which the client picks up via
 * realtime.
 */
export async function assessItemsBatch(
  ids: string[],
  profileId: string,
  concurrency = 4
): Promise<void> {
  for (let i = 0; i < ids.length; i += concurrency) {
    const batch = ids.slice(i, i + concurrency)
    await Promise.allSettled(batch.map((id) => assessItem(id, profileId)))
  }
}
