import { NextRequest } from 'next/server'
import { getBox, getBoxScan } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'

// GET /api/boxes/:boxId/scan/:scanId
// Returns the current progress of a sticker scan.
// Used as a polling fallback when Supabase Realtime events are missed.
// Response: { status, total_found, matched_count, new_count, flagged_count, illegible_count, flagged_items, illegible_entries }
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ boxId: string; scanId: string }> }
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { boxId, scanId } = await params

  // Validate box belongs to the authenticated user
  let box
  try {
    box = await getBox(boxId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }

  if (!box || box.user_profile_id !== profile.id) {
    return Response.json({ ok: false, error: 'Box not found' }, { status: 404 })
  }

  // Fetch the scan record
  const scan = await getBoxScan(scanId)
  if (!scan) {
    return Response.json({ ok: false, error: 'Scan not found' }, { status: 404 })
  }

  if (scan.box_id !== boxId) {
    return Response.json({ ok: false, error: 'Scan not found' }, { status: 404 })
  }

  return Response.json({
    scan_id: scan.id,
    status: scan.status,
    total_found: scan.total_found,
    matched_count: scan.matched_count,
    new_count: scan.new_count,
    flagged_count: scan.flagged_count,
    illegible_count: scan.illegible_count,
    flagged_items: scan.flagged_items,
    illegible_entries: scan.illegible_entries,
    created_at: scan.created_at,
    updated_at: scan.updated_at,
  })
}
