/**
 * Per-item chat prompt composer.
 *
 * Composes a system prompt for Aisling when in per-item conversation mode.
 * Lighter than background assessment mode — we're in a live dialogue about
 * one specific item.
 */

import { composeAssessmentPrompt } from '@/lib/aisling-prompt'
import type { UserProfile, ItemAssessment } from '@/types/database'
import { getCostSummary } from '@/mcp'

/**
 * Compose a system prompt for per-item chat.
 *
 * Includes:
 * - Full Aisling persona + country modules (reuses composeAssessmentPrompt)
 * - The specific item's assessment context
 * - Brief inventory summary (verdict counts, total estimated shipping)
 * - Per-item chat mode instructions
 */
export async function composePerItemChatPrompt(
  profile: UserProfile,
  item: ItemAssessment
): Promise<string> {
  const sections: string[] = []

  // 1. Base Aisling prompt (persona + profile + country modules + knowledge)
  // Strip the "Background Assessment Mode" section — we'll replace it with
  // per-item chat mode instructions.
  const basePrompt = composeAssessmentPrompt(profile)

  const bgModeIndex = basePrompt.indexOf('## Background Assessment Mode')
  const promptWithoutBgMode = bgModeIndex > -1
    ? basePrompt.slice(0, bgModeIndex).trimEnd()
    : basePrompt

  sections.push(promptWithoutBgMode)

  // 2. This item's assessment context
  sections.push(composeItemContext(item))

  // 3. Brief inventory summary (non-fatal if unavailable)
  try {
    const costSummary = await getCostSummary(profile.id)
    sections.push(composeInventorySummary(costSummary))
  } catch {
    // Non-fatal — continue without summary
  }

  // 4. Per-item chat mode instructions
  sections.push(PER_ITEM_CHAT_INSTRUCTION)

  return sections.join('\n\n')
}

function composeItemContext(item: ItemAssessment): string {
  const lines = [
    '---',
    '',
    '## This Item',
    '',
    `- **Name**: ${item.item_name}`,
  ]

  if (item.item_description) lines.push(`- **Description**: ${item.item_description}`)
  if (item.verdict) lines.push(`- **Current verdict**: ${item.verdict}`)
  if (item.advice_text) lines.push(`- **Your assessment**: ${item.advice_text}`)
  if (item.confidence !== null) lines.push(`- **Confidence**: ${item.confidence}/100`)
  if (item.needs_clarification) lines.push(`- **Needs clarification**: yes`)
  if (item.voltage_compatible !== null) lines.push(`- **Voltage compatible**: ${item.voltage_compatible ? 'yes' : 'no'}`)
  if (item.needs_transformer !== null) lines.push(`- **Needs transformer**: ${item.needs_transformer ? 'yes' : 'no'}`)
  if (item.estimated_ship_cost !== null) lines.push(`- **Estimated ship cost**: ${item.currency ?? 'USD'} ${item.estimated_ship_cost}`)
  if (item.estimated_replace_cost !== null) lines.push(`- **Estimated replace cost**: ${item.replace_currency ?? 'EUR'} ${item.estimated_replace_cost}`)
  if (item.image_url) lines.push(`- **Has photo**: yes`)

  lines.push('')
  return lines.join('\n')
}

function composeInventorySummary(costSummary: {
  counts_by_verdict: Record<string, number>
  total_estimated_ship_cost: number
  currency: string
}): string {
  const counts = costSummary.counts_by_verdict
  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  const lines = [
    '---',
    '',
    '## Inventory Summary',
    '',
    `Total items assessed: ${total}`,
  ]

  for (const [verdict, count] of Object.entries(counts)) {
    lines.push(`- ${verdict}: ${count}`)
  }

  lines.push(`- Estimated total shipping: ${costSummary.currency} ${costSummary.total_estimated_ship_cost}`)
  lines.push('')

  return lines.join('\n')
}

const PER_ITEM_CHAT_INSTRUCTION = `
---

## Per-Item Chat Mode

You are in a conversation about a specific item. The user is discussing this item with you — they may want to:
- Push back on your verdict ("Actually this has sentimental value")
- Add context ("I paid $800 for this" or "It's the Pro model, not the standard")
- Ask follow-up questions ("What about the attachments?")
- Request re-assessment ("What if I get a transformer?")

Rules:
- You have the full item context above. Reference it naturally.
- If the user provides new information that changes your assessment, call \`render_assessment_card\` with the updated verdict.
- If you update your recommendation, also call \`update_item_assessment\` to persist the change.
- Keep responses conversational and concise. This is a focused discussion about one item.
- You may reference the inventory summary for context (e.g. "You've already got 18 items to ship...").
- Do NOT ask about other items unless the user brings them up.
`.trim()
