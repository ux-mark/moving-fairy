import { getItemAssessments } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'

export async function GET() {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const decisions = await getItemAssessments(profile.id, { user_confirmed: false })
    return Response.json({ ok: true, decisions })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[decisions] GET error:', err)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
