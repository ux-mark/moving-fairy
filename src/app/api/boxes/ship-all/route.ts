import { cookies } from 'next/headers'
import { getSession, setAllBoxesShipped } from '@/mcp'

export async function POST() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value
  if (!sessionId) return Response.json({ ok: false, error: 'No session' }, { status: 401 })
  const session = await getSession(sessionId)
  if (!session) return Response.json({ ok: false, error: 'Session not found' }, { status: 401 })

  try {
    const boxesUpdated = await setAllBoxesShipped(session.user_profile_id)
    return Response.json({ ok: true, boxes_updated: boxesUpdated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
