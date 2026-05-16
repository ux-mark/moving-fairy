import { ensureShipmentsForProfile, getShipmentsForUser } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'

// GET /api/shipments — list shipments for the owner, creating defaults if missing
export async function GET() {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  try {
    // Idempotently ensure the right number of legs exist
    await ensureShipmentsForProfile(profile.id)
    const shipments = await getShipmentsForUser(profile.id)
    return Response.json(shipments)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
