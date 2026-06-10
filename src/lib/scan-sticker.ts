/**
 * scan-sticker — background sticker scan runner
 *
 * Reads a box sticker image using the LLM, fuzzy-matches the extracted item
 * names against the user's existing item_assessment records, and resolves each
 * entry into one of: matched (SHIP/CARRY), flagged (non-ship verdict),
 * new (created fresh), or illegible (null from LLM).
 *
 * Follows the same pattern as assess-item.ts:
 * - CLI mode (dev default): calls the claude CLI subprocess via callCli().
 * - SDK mode (prod / FORCE_SDK): calls the Anthropic SDK directly.
 */

import {
  addItemToBox,
  getBox,
  getItemAssessments,
  getPackedAssessmentBoxes,
  getUserProfile,
  saveItemAssessment,
  updateBoxScan,
} from '@/mcp'
import { BoxScanStatus, ItemSource, ProcessingStatus, Verdict } from '@/lib/constants'
import { callCli } from '@/lib/claude-cli'
import {
  createAnthropicClient,
  getAislingModel,
  getExecutorMode,
  withSdk401Retry,
} from '@/lib/ai/executor'
import {
  cleanupTmpImage,
  downloadImageToTmp,
  fetchImageAsBase64,
} from '@/lib/ai/image-attachment'
import { assessItem } from '@/lib/assess-item'
import type { BoxScanProposedItem, ItemAssessment, UserProfile } from '@/types/database'

// ─── Levenshtein distance ────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1]![j - 1]!
          : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!)
    }
  }
  return dp[m]![n]!
}

// ─── String normalisation ────────────────────────────────────────────────────

function normalise(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\b(a|an|the)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Fuzzy match types ───────────────────────────────────────────────────────

type MatchQuality = 'exact' | 'starts-with' | 'includes' | 'levenshtein'

interface FuzzyMatch {
  item: ItemAssessment
  quality: MatchQuality
}

const MATCH_PRIORITY: Record<MatchQuality, number> = {
  exact: 0,
  'starts-with': 1,
  includes: 2,
  levenshtein: 3,
}

// ─── Fuzzy matching ──────────────────────────────────────────────────────────

function fuzzyMatch(
  extracted: string,
  items: ItemAssessment[]
): FuzzyMatch | null {
  const query = normalise(extracted)
  if (!query) return null

  const candidates: FuzzyMatch[] = []

  for (const item of items) {
    const target = normalise(item.item_name)
    if (!target) continue

    if (query === target) {
      candidates.push({ item, quality: 'exact' })
      continue
    }

    if (target.startsWith(query) || query.startsWith(target)) {
      candidates.push({ item, quality: 'starts-with' })
      continue
    }

    if (target.includes(query) || query.includes(target)) {
      candidates.push({ item, quality: 'includes' })
      continue
    }

    if (levenshtein(query, target) <= 2) {
      candidates.push({ item, quality: 'levenshtein' })
    }
  }

  if (candidates.length === 0) return null

  // Sort by priority (exact best, levenshtein worst) then return the best
  candidates.sort(
    (a, b) => MATCH_PRIORITY[a.quality] - MATCH_PRIORITY[b.quality]
  )
  return candidates[0]!
}

// ─── LLM call: extract item names from sticker image ─────────────────────────

const STICKER_SYSTEM_PROMPT =
  'You are reading a handwritten inventory sticker on a moving box. ' +
  'Extract every item name you can read from this list. ' +
  'Return a JSON array of strings, one per item. ' +
  'If you cannot read an entry, include it as null. ' +
  'Be generous with interpretation — handwriting is messy. ' +
  'Return ONLY the JSON array, no other text.'

async function extractItemNamesViaSdk(
  imageUrl: string,
  profile: UserProfile
): Promise<Array<string | null>> {
  const model = getAislingModel()

  return withSdk401Retry(profile, 'scan-sticker', async (apiKey) => {
    const client = await createAnthropicClient(apiKey)
    const { base64, mediaType } = await fetchImageAsBase64(imageUrl)

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: STICKER_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType as 'image/webp', data: base64 },
            },
            {
              type: 'text',
              text: 'Extract all item names from this handwritten box sticker.',
            },
          ],
        },
      ],
    })

    for (const block of response.content) {
      if (block.type === 'text') {
        return parseItemNamesJson(block.text)
      }
    }
    return []
  })
}

async function extractItemNamesViaCli(imageUrl: string): Promise<Array<string | null>> {
  const model = getAislingModel()

  // Download the sticker image to a temp file so the CLI's Read tool can view it.
  // imageUrl may be a relative storage path — resolve it to a full URL first
  // (mirrors the SDK path's fetchImageAsBase64).
  const tmpPath = `/tmp/sticker-scan-${Date.now()}.webp`
  try {
    await downloadImageToTmp(imageUrl, tmpPath, 'scan-sticker')
  } catch (imgErr) {
    console.warn('[scan-sticker] Could not download sticker image:', imgErr)
    throw imgErr
  }

  try {
    const userPrompt =
      `Use the Read tool to view the image at ${tmpPath}.\n\n` +
      'This is a handwritten inventory sticker on a moving box. ' +
      'Extract every item name you can read from the list. ' +
      'Return ONLY a JSON array of strings, one per item. ' +
      'If you cannot read an entry, include it as null. ' +
      'Example output: ["Kitchen mixer", "Blender", null, "Coffee maker"]'

    const responseText = await callCli(userPrompt, STICKER_SYSTEM_PROMPT, model, {
      addDirs: ['/tmp'],
    })
    return parseItemNamesJson(responseText)
  } finally {
    cleanupTmpImage(tmpPath)
  }
}

function parseItemNamesJson(text: string): Array<string | null> {
  // Extract JSON array from response — the LLM may wrap it in markdown
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    console.warn('[scan-sticker] No JSON array found in LLM response:', text.slice(0, 200))
    return []
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) =>
      item === null || item === undefined
        ? null
        : typeof item === 'string'
        ? item.trim() || null
        : null
    )
  } catch {
    console.warn('[scan-sticker] Failed to parse JSON from LLM response:', jsonMatch[0].slice(0, 200))
    return []
  }
}

// ─── Main runStickerScan function ────────────────────────────────────────────

/**
 * runStickerScan — background sticker scan runner
 *
 * Accepts a pre-created scan ID (created by the API route before returning
 * 202 to the client). Updates the box_scan record and resolves each item.
 *
 * The API route creates the scan record synchronously before firing this
 * function in the background, so the client always receives a scan_id.
 */
export async function runStickerScan(
  scanId: string,
  boxId: string,
  manifestImageUrl: string,
  profileId: string
): Promise<void> {
  try {
    // 1. Verify the box exists
    let box
    try {
      box = await getBox(boxId)
    } catch (err) {
      console.error(`[scan-sticker] Box ${boxId} not found:`, err)
      await updateBoxScan(scanId, { status: BoxScanStatus.FAILED })
      return
    }

    if (box.user_profile_id !== profileId) {
      console.error(`[scan-sticker] Box ${boxId} does not belong to profile ${profileId}`)
      await updateBoxScan(scanId, { status: BoxScanStatus.FAILED })
      return
    }

    // 2. Load user profile
    const profile = await getUserProfile(profileId)
    if (!profile) {
      console.error(`[scan-sticker] Profile ${profileId} not found`)
      await updateBoxScan(scanId, { status: BoxScanStatus.FAILED })
      return
    }

    console.log(`[scan-sticker] Running scan ${scanId} for box ${boxId}`)

    // 4. Call the LLM to extract item names from the sticker image
    const useSdk = getExecutorMode() === 'sdk'
    console.log(`[scan-sticker] Extracting items from sticker | mode: ${useSdk ? 'sdk' : 'cli'}`)

    let extractedNames: Array<string | null>
    try {
      extractedNames = useSdk
        ? await extractItemNamesViaSdk(manifestImageUrl, profile)
        : await extractItemNamesViaCli(manifestImageUrl)
    } catch (llmErr) {
      console.error('[scan-sticker] LLM extraction failed:', llmErr)
      await updateBoxScan(scanId, { status: BoxScanStatus.FAILED })
      return
    }

    console.log(`[scan-sticker] LLM extracted ${extractedNames.length} entries:`, extractedNames)

    if (extractedNames.length === 0) {
      await updateBoxScan(scanId, {
        status: BoxScanStatus.COMPLETE,
        total_found: 0,
      })
      return
    }

    // 5. Fetch existing items (for fuzzy matching) plus where each packed item
    //    sits. Matches already in THIS box are silently counted; a match packed
    //    in a DIFFERENT box is surfaced as a possible duplicate (a handwritten
    //    "Blender" when one sits in WH03 often means a second blender).
    const existingItems = await getItemAssessments(profileId)
    const packedBoxes = await getPackedAssessmentBoxes(profileId)

    // 6. Resolve each extracted entry into matched / new / flagged / duplicate.
    //    Nothing is silently committed: matched-unpacked and new items go into
    //    the box as DRAFTS for the owner to confirm; non-ship matches are
    //    flagged; packed-elsewhere matches await an add-or-skip decision.
    let matchedCount = 0
    let newCount = 0
    let flaggedCount = 0
    let duplicateCount = 0
    const illegibleEntries: string[] = []
    const flaggedItems: Array<{ item_assessment_id: string; verdict: string; item_name: string }> = []
    const proposedItems: BoxScanProposedItem[] = []

    const nonNullEntries = extractedNames.filter((n): n is string => n !== null)
    const illegibleCount = extractedNames.filter((n) => n === null).length

    // Items already placed during THIS scan or already in this box — guards a
    // label that lists the same item twice.
    const handledIds = new Set<string>(
      box.items
        .map((i) => i.item_assessment_id)
        .filter((id): id is string => id !== null)
    )

    // Add an item to the box as a draft and record the proposal for review.
    const proposeDraft = async (
      assessmentId: string,
      itemName: string,
      kind: 'matched' | 'new',
      verdict: string | null
    ): Promise<boolean> => {
      try {
        const boxItem = await addItemToBox(boxId, {
          itemAssessmentId: assessmentId,
          isDraft: true,
        })
        proposedItems.push({
          box_item_id: boxItem.id,
          item_assessment_id: assessmentId,
          item_name: itemName,
          kind,
          verdict,
        })
        handledIds.add(assessmentId)
        return true
      } catch (addErr) {
        console.warn(`[scan-sticker] Could not add "${itemName}" as a draft:`, addErr)
        return false
      }
    }

    for (const itemName of nonNullEntries) {
      const match = fuzzyMatch(itemName, existingItems)

      if (match) {
        const { item, quality } = match
        const verdict = item.verdict

        console.log(
          `[scan-sticker] "${itemName}" → matched "${item.item_name}" (${quality}, verdict: ${verdict ?? 'pending'})`
        )

        // Already in THIS box (or placed during this scan) — genuinely here;
        // count silently.
        if (handledIds.has(item.id)) {
          matchedCount++
          continue
        }

        // Packed in a DIFFERENT box — possibly a second physical item. Don't
        // create anything yet; record a duplicate proposal so the owner can
        // decide in the review (add as another, or skip).
        const packedIn = packedBoxes.get(item.id)
        if (packedIn) {
          proposedItems.push({
            box_item_id: null,
            item_assessment_id: item.id,
            item_name: item.item_name,
            kind: 'duplicate',
            verdict,
            extracted_text: itemName,
            packed_box_id: packedIn.box_id,
            packed_box_label: packedIn.box_label,
          })
          duplicateCount++
          // Same entry twice on one label → one proposal; repeats count as matched.
          handledIds.add(item.id)
          continue
        }

        if (
          verdict === Verdict.SELL ||
          verdict === Verdict.DONATE ||
          verdict === Verdict.DISCARD ||
          verdict === Verdict.REVISIT
        ) {
          // Verdict says don't ship — flag for the owner, do not add.
          flaggedItems.push({ item_assessment_id: item.id, verdict, item_name: item.item_name })
          flaggedCount++
          continue
        }

        // SHIP / CARRY / pending(null) → propose as a draft match.
        if (await proposeDraft(item.id, item.item_name, 'matched', verdict)) {
          matchedCount++
        }
      } else {
        // No match — create a new item and propose it as a draft.
        console.log(`[scan-sticker] "${itemName}" → no match, creating new draft item`)
        try {
          const newItem = await saveItemAssessment({
            user_profile_id: profileId,
            item_name: itemName,
            verdict: null,
            processing_status: ProcessingStatus.PENDING,
            source: ItemSource.STICKER_SCAN,
          })
          if (await proposeDraft(newItem.id, itemName, 'new', null)) {
            // Assess in the background so the review shows a real verdict/value.
            // assessItem sets processing_status to PROCESSING before the LLM call.
            void assessItem(newItem.id, profileId)
            newCount++
          }
        } catch (createErr) {
          console.warn(`[scan-sticker] Could not create item for "${itemName}":`, createErr)
          // Non-fatal — skip this entry
        }
      }
    }

    // 7. Update scan record with final counts + the draft proposals.
    await updateBoxScan(scanId, {
      status: BoxScanStatus.COMPLETE,
      total_found: extractedNames.length,
      matched_count: matchedCount,
      new_count: newCount,
      flagged_count: flaggedCount,
      duplicate_count: duplicateCount,
      illegible_count: illegibleCount,
      illegible_entries: illegibleEntries,
      flagged_items: flaggedItems,
      proposed_items: proposedItems,
    })

    console.log(
      `[scan-sticker] Scan ${scanId} complete: total=${extractedNames.length}, ` +
        `matched=${matchedCount}, new=${newCount}, flagged=${flaggedCount}, duplicate=${duplicateCount}, illegible=${illegibleCount}`
    )
  } catch (err) {
    console.error(`[scan-sticker] Unexpected error for box ${boxId}:`, err)
    try {
      await updateBoxScan(scanId, { status: BoxScanStatus.FAILED })
    } catch (updateErr) {
      console.error('[scan-sticker] Failed to set scan status to failed:', updateErr)
    }
  }
}
