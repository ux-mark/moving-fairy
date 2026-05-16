import { NextRequest } from 'next/server'
import { getManifest, getShipment, updateShipment } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'
import { ShipmentStatus } from '@/lib/constants'

async function ownedShipmentOr404(id: string, userProfileId: string) {
  const ship = await getShipment(id)
  if (!ship) return null
  if (ship.user_profile_id !== userProfileId) return null
  return ship
}

// GET /api/shipments/:id?manifest=1 — include manifest data on request
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const ship = await ownedShipmentOr404(id, profile.id)
  if (!ship) {
    return Response.json({ ok: false, error: 'Shipment not found' }, { status: 404 })
  }

  const url = new URL(req.url)
  const includeManifest = url.searchParams.get('manifest') === '1'

  try {
    if (includeManifest) {
      const manifest = await getManifest(id)
      return Response.json(manifest)
    }
    return Response.json(ship)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}

interface PatchShipmentBody {
  label?: string
  status?: string
  target_date?: string | null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const ship = await ownedShipmentOr404(id, profile.id)
  if (!ship) {
    return Response.json({ ok: false, error: 'Shipment not found' }, { status: 404 })
  }

  let body: PatchShipmentBody
  try {
    body = (await req.json()) as PatchShipmentBody
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  const changes: Parameters<typeof updateShipment>[1] = {}
  if (body.label !== undefined) {
    const trimmed = body.label.trim()
    if (!trimmed) {
      return Response.json({ ok: false, error: 'Label cannot be empty' }, { status: 400 })
    }
    changes.label = trimmed
  }
  if (body.status !== undefined) {
    const valid = Object.values(ShipmentStatus) as string[]
    if (!valid.includes(body.status)) {
      return Response.json({ ok: false, error: 'Invalid status' }, { status: 400 })
    }
    changes.status = body.status as ShipmentStatus
  }
  if (body.target_date !== undefined) changes.target_date = body.target_date

  if (Object.keys(changes).length === 0) {
    return Response.json({ ok: false, error: 'Nothing to update' }, { status: 400 })
  }

  try {
    const updated = await updateShipment(id, changes)
    return Response.json(updated)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
