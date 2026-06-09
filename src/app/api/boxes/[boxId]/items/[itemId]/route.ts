import { moveItemToBox, removeItemFromBox } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'

interface MoveItemBody {
  to_box_id?: string
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ boxId: string; itemId: string }> }
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  const { itemId } = await params

  let body: MoveItemBody
  try {
    body = (await req.json()) as MoveItemBody
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.to_box_id || typeof body.to_box_id !== 'string') {
    return Response.json({ ok: false, error: 'to_box_id is required' }, { status: 400 })
  }

  try {
    const boxItem = await moveItemToBox(itemId, body.to_box_id, profile.id)
    return Response.json(boxItem)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    if (message === 'Box item not found' || message === 'Box not found' || message === 'Destination box not found') {
      return Response.json({ ok: false, error: message }, { status: 404 })
    }
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ boxId: string; itemId: string }> }
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  const { boxId, itemId } = await params
  try {
    await removeItemFromBox(boxId, itemId, profile.id)
    return Response.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    if (message === 'Box not found') {
      return Response.json({ ok: false, error: message }, { status: 404 })
    }
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
