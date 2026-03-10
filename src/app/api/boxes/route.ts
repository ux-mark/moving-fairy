import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { getSession, getBoxes, getBox, createBox } from '@/mcp'
import { BoxType, BoxSize } from '@/lib/constants'

export async function GET() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value
  if (!sessionId) return Response.json({ ok: false, error: 'No session' }, { status: 401 })
  const session = await getSession(sessionId)
  if (!session) return Response.json({ ok: false, error: 'Session not found' }, { status: 401 })

  const boxes = await getBoxes(session.user_profile_id)
  const boxesWithItems = await Promise.all(boxes.map((b) => getBox(b.id)))
  return Response.json(boxesWithItems)
}

interface CreateBoxBody {
  room_name: string
  box_type?: string
  size?: string
  item_label?: string
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value
  if (!sessionId) return Response.json({ ok: false, error: 'No session' }, { status: 401 })
  const session = await getSession(sessionId)
  if (!session) return Response.json({ ok: false, error: 'Session not found' }, { status: 401 })

  const body = (await req.json()) as CreateBoxBody
  if (!body.room_name) {
    return Response.json({ ok: false, error: 'room_name is required' }, { status: 400 })
  }

  const box = await createBox(
    session.user_profile_id,
    body.room_name,
    (body.box_type as BoxType) ?? BoxType.STANDARD,
    body.size ? (body.size as BoxSize) : undefined,
    body.item_label
  )
  return Response.json(box, { status: 201 })
}
