import { getItemAssessments, updateItemAssessment } from '@/mcp'
import { getUserProfile } from '@/mcp'
import { ProcessingStatus, Verdict } from '@/lib/constants'

/**
 * assessItem — background assessment runner
 *
 * Fetches the item and profile, then calls the LLM to produce an assessment.
 * Updates processing_status to 'completed' (or 'failed') when done.
 *
 * TODO: Replace the placeholder implementation with a real LLM call:
 *   - Load Aisling persona from .claude/agents/aisling.md
 *   - Load country modules based on user profile route
 *   - Call Claude API with the item (image or text) + render_assessment_card tool
 *   - Parse response, extract verdict/costs/rationale
 *   - Update item_assessment with results
 */
export async function assessItem(itemId: string, profileId: string): Promise<void> {
  try {
    // Verify item exists and belongs to the user
    const items = await getItemAssessments(profileId)
    const item = items.find((a) => a.id === itemId)
    if (!item) {
      console.error(`[assess-item] Item ${itemId} not found for profile ${profileId}`)
      return
    }

    // Load user profile for route context
    const profile = await getUserProfile(profileId)
    if (!profile) {
      console.error(`[assess-item] Profile ${profileId} not found`)
      await updateItemAssessment(itemId, { processing_status: ProcessingStatus.FAILED }, profileId)
      return
    }

    // TODO: Call LLM for assessment
    console.log(
      `[assess-item] TODO: Call LLM for item "${item.item_name}" (${itemId}) ` +
      `| route: ${profile.departure_country} → ${profile.arrival_country}` +
      `${profile.onward_country ? ` → ${profile.onward_country}` : ''}`
    )

    // Placeholder: simulate async work then mark completed with stub data
    await new Promise<void>((resolve) => setTimeout(resolve, 2000))

    await updateItemAssessment(
      itemId,
      {
        processing_status: ProcessingStatus.COMPLETED,
        verdict: Verdict.REVISIT,
        advice_text: 'Assessment pending LLM integration. Please check back soon.',
        confidence: null,
        needs_clarification: false,
      },
      profileId
    )
  } catch (err) {
    console.error(`[assess-item] Unexpected error for item ${itemId}:`, err)
    try {
      await updateItemAssessment(itemId, { processing_status: ProcessingStatus.FAILED }, profileId)
    } catch (updateErr) {
      console.error(`[assess-item] Failed to set error status for item ${itemId}:`, updateErr)
    }
  }
}
