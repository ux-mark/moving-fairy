import { NextRequest } from 'next/server'
import { assignBoxToShipment, getBox, getShipment } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'

interface PatchBody {
  shipment_id: string | null
}

// PATCH /api/boxes/:boxId/shipment — attach or detach a box from a shipment
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ boxId: string }> },
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { boxId } = await params

  let body: PatchBody
  try {
    body = (await req.json()) as PatchBody
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  // Verify the box belongs to this user (closes IDOR — caller could otherwise
  // attach someone else's box to their own shipment by guessing the id).
  const box = await getBox(boxId)
  if (!box || box.user_profile_id !== profile.id) {
    return Response.json({ ok: false, error: 'Box not found' }, { status: 404 })
  }

  // If attaching, verify the shipment belongs to this user
  if (body.shipment_id) {
    const ship = await getShipment(body.shipment_id)
    if (!ship || ship.user_profile_id !== profile.id) {
      return Response.json({ ok: false, error: 'Shipment not found' }, { status: 404 })
    }
  }

  try {
    const box = await assignBoxToShipment(boxId, body.shipment_id)
    return Response.json(box)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
