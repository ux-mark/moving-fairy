import { getCostSummary } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'

export async function GET() {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  try {
    const summary = await getCostSummary(profile.id)
    return Response.json(summary)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
