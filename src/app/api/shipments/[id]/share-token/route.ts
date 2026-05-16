import { NextRequest } from 'next/server'
import { generateShareToken, getShipment } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const ship = await getShipment(id)
  if (!ship || ship.user_profile_id !== profile.id) {
    return Response.json({ ok: false, error: 'Shipment not found' }, { status: 404 })
  }

  try {
    const token = await generateShareToken(id)
    return Response.json({ token })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
