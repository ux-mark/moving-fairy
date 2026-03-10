import { findOrCreateSession, getCostSummary } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'

export async function GET() {
  const { user, profile } = await getAuthenticatedProfile()

  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const session = await findOrCreateSession(profile.id)

  // Get assessment summary
  let summary = {
    total_items: 0,
    ship_count: 0,
    sell_count: 0,
    donate_count: 0,
    discard_count: 0,
    carry_count: 0,
    decide_later_count: 0,
    total_cost: 0,
    currency: 'USD',
  }

  try {
    const costData = await getCostSummary(profile.id)
    const counts = costData.counts_by_verdict
    summary = {
      total_items: Object.values(counts).reduce((sum, n) => sum + n, 0),
      ship_count: counts['SHIP'] ?? 0,
      sell_count: counts['SELL'] ?? 0,
      donate_count: counts['DONATE'] ?? 0,
      discard_count: counts['DISCARD'] ?? 0,
      carry_count: counts['CARRY'] ?? 0,
      decide_later_count: counts['DECIDE_LATER'] ?? 0,
      total_cost: costData.total_estimated_ship_cost,
      currency: costData.currency,
    }
  } catch {
    // Non-fatal — return empty summary
  }

  const messages = Array.isArray(session.messages) ? session.messages : []
  const hasHistory = messages.length > 0

  // Strip sensitive fields before returning profile
  const { anthropic_api_key: _, ...safeProfile } = profile

  return Response.json({
    ok: true,
    session: {
      id: session.id,
      user_profile_id: session.user_profile_id,
      created_at: session.created_at,
      updated_at: session.updated_at,
    },
    profile: safeProfile,
    summary,
    has_history: hasHistory,
    recent_messages: messages.slice(-20),
  })
}
