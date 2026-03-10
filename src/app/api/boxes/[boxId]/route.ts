import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { getSession, updateBoxCbm, updateBoxStatus } from '@/mcp'
import { BoxStatus } from '@/lib/constants'

interface PatchBoxBody {
  status?: string
  cbm?: number
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ boxId: string }> }
) {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value
  if (!sessionId) return Response.json({ ok: false, error: 'No session' }, { status: 401 })
  const session = await getSession(sessionId)
  if (!session) return Response.json({ ok: false, error: 'Session not found' }, { status: 401 })

  const { boxId } = await params
  const body = (await req.json()) as PatchBoxBody

  try {
    if (body.status !== undefined) {
      const box = await updateBoxStatus(boxId, body.status as BoxStatus)
      return Response.json(box)
    }

    if (body.cbm !== undefined) {
      const box = await updateBoxCbm(boxId, body.cbm)
      return Response.json(box)
    }

    return Response.json({ ok: false, error: 'Nothing to update' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
