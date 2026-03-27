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
  getUserProfile,
  saveItemAssessment,
  updateBoxScan,
} from '@/mcp'
import { BoxScanStatus, ItemSource, ProcessingStatus, Verdict } from '@/lib/constants'
import { callCli, useCliMode } from '@/lib/claude-cli'
import { getAnthropicApiKey, refreshAnthropicApiKey } from '@/lib/dev-api-key'
import { buildStorageUrl } from '@/lib/storage-url'
import { assessItem } from '@/lib/assess-item'
import type { ItemAssessment, UserProfile } from '@/types/database'

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

// ─── API key resolution ───────────────────────────────────────────────────────

function getApiKey(profile: UserProfile): string {
  if (process.env.NODE_ENV === 'development') {
    return getAnthropicApiKey()
  }
  return profile.anthropic_api_key ?? process.env.ANTHROPIC_API_KEY ?? ''
}

// ─── LLM call: extract item names from sticker image ─────────────────────────

const STICKER_SYSTEM_PROMPT =
  'You are reading a handwritten inventory sticker on a moving box. ' +
  'Extract every item name you can read from this list. ' +
  'Return a JSON array of strings, one per item. ' +
  'If you cannot read an entry, include it as null. ' +
  'Be generous with interpretation — handwriting is messy. ' +
  'Return ONLY the JSON array, no other text.'

async function fetchImageAsBase64(
  imageUrl: string
): Promise<{ base64: string; mediaType: string }> {
  const resolvedUrl = buildStorageUrl(imageUrl)
  const response = await fetch(resolvedUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch sticker image: ${response.status} ${response.statusText}`)
  }
  const contentType = response.headers.get('content-type') ?? 'image/webp'
  const mediaType = contentType.startsWith('image/') ? contentType : 'image/webp'
  const buffer = await response.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  return { base64, mediaType }
}

async function extractItemNamesViaSdk(
  imageUrl: string,
  profile: UserProfile
): Promise<Array<string | null>> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const model = process.env.MODEL_AISLING ?? 'claude-sonnet-4-6'

  async function attempt(apiKey: string): Promise<Array<string | null>> {
    const client = new Anthropic({ apiKey })
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
  }

  const apiKey = getApiKey(profile)
  try {
    return await attempt(apiKey)
  } catch (err) {
    if (
      process.env.NODE_ENV === 'development' &&
      err instanceof Error &&
      err.message.includes('401')
    ) {
      console.warn('[scan-sticker] Got 401 from SDK — refreshing API key and retrying')
      const freshKey = refreshAnthropicApiKey()
      return await attempt(freshKey)
    }
    throw err
  }
}

async function extractItemNamesViaCli(imageUrl: string): Promise<Array<string | null>> {
  const model = process.env.MODEL_AISLING ?? 'claude-sonnet-4-6'

  // Download the sticker image to a temp file so the CLI's Read tool can view it
  const tmpPath = `/tmp/sticker-scan-${Date.now()}.webp`
  try {
    const imgResponse = await fetch(imageUrl)
    if (!imgResponse.ok) throw new Error(`HTTP ${imgResponse.status}`)
    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer())
    const { writeFile } = await import('fs/promises')
    await writeFile(tmpPath, imgBuffer)
    console.log(`[scan-sticker] Saved sticker image to ${tmpPath} (${imgBuffer.length} bytes)`)
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
    const { unlink } = await import('fs/promises')
    unlink(tmpPath).catch(() => {})
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
    const useSdk = !useCliMode()
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

    // 5. Fetch all existing item assessments for this user for fuzzy matching
    const existingItems = await getItemAssessments(profileId)

    // 6. Resolve each extracted entry
    let matchedCount = 0
    let newCount = 0
    let flaggedCount = 0
    let illegibleCount = 0
    const illegibleEntries: string[] = []
    const flaggedItems: Array<{ item_assessment_id: string; verdict: string; item_name: string }> = []

    const nonNullEntries = extractedNames.filter((n): n is string => n !== null)
    const nullEntries = extractedNames.filter((n) => n === null)

    // Tally illegible entries
    illegibleCount = nullEntries.length

    // Get existing box item assessment IDs to avoid duplicates
    const existingBoxAssessmentIds = new Set(
      box.items
        .map((i) => i.item_assessment_id)
        .filter((id): id is string => id !== null)
    )

    for (const itemName of nonNullEntries) {
      const match = fuzzyMatch(itemName, existingItems)

      if (match) {
        const { item, quality } = match
        const verdict = item.verdict

        console.log(
          `[scan-sticker] "${itemName}" → matched "${item.item_name}" (${quality}, verdict: ${verdict ?? 'pending'})`
        )

        if (verdict === Verdict.SHIP || verdict === Verdict.CARRY) {
          // Skip if already in this box
          if (existingBoxAssessmentIds.has(item.id)) {
            console.log(`[scan-sticker] "${item.item_name}" already in box — skipping`)
            matchedCount++
            continue
          }
          // Auto-assign to box
          try {
            await addItemToBox(boxId, { itemAssessmentId: item.id })
            existingBoxAssessmentIds.add(item.id)
            matchedCount++
          } catch (addErr) {
            console.warn(
              `[scan-sticker] Could not add "${item.item_name}" to box ${boxId}:`,
              addErr
            )
            // Non-fatal — still count it as matched
            matchedCount++
          }
        } else if (
          verdict === Verdict.SELL ||
          verdict === Verdict.DONATE ||
          verdict === Verdict.DISCARD ||
          verdict === Verdict.REVISIT
        ) {
          // Flag it — do not auto-add
          flaggedItems.push({
            item_assessment_id: item.id,
            verdict: verdict,
            item_name: item.item_name,
          })
          flaggedCount++
        } else {
          // Verdict is null (assessment pending) — treat as matched, add to box
          // when verdict resolves the item may need review, but we don't block here
          if (!existingBoxAssessmentIds.has(item.id)) {
            try {
              // Only add if verdict is null (pending) — do not re-add if processing
              if (item.verdict === null) {
                await addItemToBox(boxId, { itemAssessmentId: item.id })
                existingBoxAssessmentIds.add(item.id)
              }
              matchedCount++
            } catch {
              matchedCount++
            }
          } else {
            matchedCount++
          }
        }
      } else {
        // No match — create new item assessment and add to box
        console.log(`[scan-sticker] "${itemName}" → no match, creating new item`)
        try {
          const newItem = await saveItemAssessment({
            user_profile_id: profileId,
            item_name: itemName,
            verdict: null,
            processing_status: ProcessingStatus.PENDING,
            source: ItemSource.STICKER_SCAN,
          })

          // Add new item to box
          await addItemToBox(boxId, { itemAssessmentId: newItem.id })

          // Fire assessment in the background (fire-and-forget)
          // assessItem sets processing_status to PROCESSING before calling the LLM
          void assessItem(newItem.id, profileId)

          newCount++
          existingBoxAssessmentIds.add(newItem.id)
        } catch (createErr) {
          console.warn(`[scan-sticker] Could not create item for "${itemName}":`, createErr)
          // Non-fatal — skip this entry
        }
      }
    }

    // 7. Update scan record with final counts
    await updateBoxScan(scanId, {
      status: BoxScanStatus.COMPLETE,
      total_found: extractedNames.length,
      matched_count: matchedCount,
      new_count: newCount,
      flagged_count: flaggedCount,
      illegible_count: illegibleCount,
      illegible_entries: illegibleEntries,
      flagged_items: flaggedItems,
    })

    console.log(
      `[scan-sticker] Scan ${scanId} complete: total=${extractedNames.length}, ` +
        `matched=${matchedCount}, new=${newCount}, flagged=${flaggedCount}, illegible=${illegibleCount}`
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
