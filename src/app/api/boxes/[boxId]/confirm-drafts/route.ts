import { NextRequest } from 'next/server'
import { confirmBoxDrafts } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'

// POST /api/boxes/:boxId/confirm-drafts
// Confirms every draft item in the box — flips is_draft to false so the items
// join the official manifest. Used by the post-scan review's "Add all" action.
// Returns { ok, box_items } — the confirmed rows.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ boxId: string }> }
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { boxId } = await params

  try {
    const boxItems = await confirmBoxDrafts(boxId, profile.id)
    return Response.json({ ok: true, box_items: boxItems })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    const status = message === 'Box not found' ? 404 : 500
    return Response.json({ ok: false, error: message }, { status })
  }
}
