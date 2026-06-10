import { NextRequest } from 'next/server'
import { addItemToBox, getBoxItemsDetailed } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'

interface AddItemBody {
  item_assessment_id?: string
  item_name?: string
}

// GET /api/boxes/:boxId/items
// Returns { box_items, assessments } for the box, drafts included. Used to
// refresh a box's contents on the client after a sticker scan adds drafts.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ boxId: string }> }
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  const { boxId } = await params
  try {
    const { items, assessments } = await getBoxItemsDetailed(boxId, profile.id)
    return Response.json({ ok: true, box_items: items, assessments })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    const status = message === 'Box not found' ? 404 : 500
    return Response.json({ ok: false, error: message }, { status })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ boxId: string }> }
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  const { boxId } = await params
  const body = (await req.json()) as AddItemBody

  const opts: { itemAssessmentId?: string; itemName?: string } = {}
  if (body.item_assessment_id !== undefined) opts.itemAssessmentId = body.item_assessment_id
  if (body.item_name !== undefined) opts.itemName = body.item_name

  try {
    const boxItem = await addItemToBox(boxId, opts, profile.id)
    return Response.json(boxItem, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    if (message === 'Box not found') {
      return Response.json({ ok: false, error: message }, { status: 404 })
    }
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
