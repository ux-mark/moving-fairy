import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { getSession, addItemToBox } from '@/mcp'

interface AddItemBody {
  item_assessment_id?: string
  item_name?: string
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ boxId: string }> }
) {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value
  if (!sessionId) return Response.json({ ok: false, error: 'No session' }, { status: 401 })
  const session = await getSession(sessionId)
  if (!session) return Response.json({ ok: false, error: 'Session not found' }, { status: 401 })

  const { boxId } = await params
  const body = (await req.json()) as AddItemBody

  const opts: { itemAssessmentId?: string; itemName?: string } = {}
  if (body.item_assessment_id !== undefined) opts.itemAssessmentId = body.item_assessment_id
  if (body.item_name !== undefined) opts.itemName = body.item_name

  const boxItem = await addItemToBox(boxId, opts)
  return Response.json(boxItem, { status: 201 })
}
