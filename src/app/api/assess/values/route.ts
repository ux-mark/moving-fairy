import { getUnassessedItemIds } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'
import { assessItemsBatch } from '@/lib/assess-item'

// POST /api/assess/values
// Bulk "value my inventory" — assesses every item that has never been
// successfully assessed (pending or failed), filling in replacement values.
// Completed items are left untouched so a confirmed verdict is never clobbered.
// Returns { ok, queued } immediately; assessments run in the background and the
// client picks up results via the item realtime subscription.
export async function POST() {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const ids = await getUnassessedItemIds(profile.id)
    if (ids.length > 0) {
      void assessItemsBatch(ids, profile.id)
    }
    return Response.json({ ok: true, queued: ids.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
