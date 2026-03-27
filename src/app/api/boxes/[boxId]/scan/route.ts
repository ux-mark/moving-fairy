import { NextRequest } from 'next/server'
import { createBoxScan, getBox } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'
import { runStickerScan } from '@/lib/scan-sticker'

interface ScanRequestBody {
  manifest_image_url: string
}

// POST /api/boxes/:boxId/scan
// Initiates a background sticker scan for the given box.
// Accepts { manifest_image_url: string } in the request body.
// Returns { scan_id } immediately — the scan runs in the background.
// The client subscribes to Supabase Realtime on the box_scan table
// or polls GET /api/boxes/:boxId/scan/:scanId for progress updates.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ boxId: string }> }
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { boxId } = await params

  // Validate box exists and belongs to the authenticated user
  let box
  try {
    box = await getBox(boxId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }

  if (!box) {
    return Response.json({ ok: false, error: 'Box not found' }, { status: 404 })
  }

  if (box.user_profile_id !== profile.id) {
    return Response.json({ ok: false, error: 'Box not found' }, { status: 404 })
  }

  let body: ScanRequestBody
  try {
    body = (await req.json()) as ScanRequestBody
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.manifest_image_url || typeof body.manifest_image_url !== 'string') {
    return Response.json(
      { ok: false, error: 'manifest_image_url is required' },
      { status: 400 }
    )
  }

  // Create the scan record synchronously so we can return the scan_id
  // The scan itself runs in the background via fire-and-forget
  let scanId: string
  try {
    const scan = await createBoxScan(boxId)
    scanId = scan.id
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }

  // Fire the background scan — does not await
  // The client picks up progress via Supabase Realtime on box_scan table
  void runStickerScan(scanId, boxId, body.manifest_image_url, profile.id)

  return Response.json({ scan_id: scanId }, { status: 202 })
}
