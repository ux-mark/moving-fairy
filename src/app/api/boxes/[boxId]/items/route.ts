import { NextRequest } from 'next/server'
import { addItemToBox } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'

interface AddItemBody {
  item_assessment_id?: string
  item_name?: string
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
    const boxItem = await addItemToBox(boxId, opts)
    return Response.json(boxItem, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
