import { setAllBoxesShipped } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'

export async function POST() {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  try {
    const boxesUpdated = await setAllBoxesShipped(profile.id)
    return Response.json({ ok: true, boxes_updated: boxesUpdated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
