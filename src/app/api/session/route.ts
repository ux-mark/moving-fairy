import { cookies } from 'next/headers'
import { getSession, getUserProfile, getCostSummary } from '@/mcp'

export async function GET() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value

  if (!sessionId) {
    return Response.json({ ok: false, error: 'No session' }, { status: 401 })
  }

  const session = await getSession(sessionId)
  if (!session) {
    return Response.json({ ok: false, error: 'Session not found' }, { status: 401 })
  }

  const profile = await getUserProfile(sessionId)
  if (!profile) {
    return Response.json({ ok: false, error: 'Profile not found' }, { status: 404 })
  }

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

  return Response.json({
    ok: true,
    session: {
      id: session.id,
      user_profile_id: session.user_profile_id,
      created_at: session.created_at,
      updated_at: session.updated_at,
    },
    profile,
    summary,
    has_history: hasHistory,
    recent_messages: messages.slice(-20),
  })
}
