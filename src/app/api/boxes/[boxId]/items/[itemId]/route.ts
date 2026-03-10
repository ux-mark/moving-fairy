import { cookies } from 'next/headers'
import { getSession, removeItemFromBox } from '@/mcp'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ boxId: string; itemId: string }> }
) {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value
  if (!sessionId) return Response.json({ ok: false, error: 'No session' }, { status: 401 })
  const session = await getSession(sessionId)
  if (!session) return Response.json({ ok: false, error: 'Session not found' }, { status: 401 })

  const { boxId, itemId } = await params
  try {
    await removeItemFromBox(boxId, itemId)
    return Response.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
