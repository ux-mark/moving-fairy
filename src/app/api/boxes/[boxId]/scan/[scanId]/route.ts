import { NextRequest } from 'next/server'
import { addItemToBox, getBox, getBoxScan, saveItemAssessment, updateBoxScan } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'
import { assessItem } from '@/lib/assess-item'
import { ItemSource, ProcessingStatus } from '@/lib/constants'
import type { BoxScan } from '@/types/database'

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
    duplicate_count: scan.duplicate_count,
    illegible_count: scan.illegible_count,
    flagged_items: scan.flagged_items,
    proposed_items: scan.proposed_items,
    illegible_entries: scan.illegible_entries,
    created_at: scan.created_at,
    updated_at: scan.updated_at,
  })
}

interface DuplicateActionBody {
  action: 'add_duplicate' | 'skip_duplicate'
  item_assessment_id: string
}

// Drop one duplicate proposal from the scan's bookkeeping (jsonb) and keep the
// duplicate_count column in step.
async function removeDuplicateProposal(scan: BoxScan, itemAssessmentId: string) {
  await updateBoxScan(scan.id, {
    proposed_items: scan.proposed_items.filter(
      (p) => !(p.kind === 'duplicate' && p.item_assessment_id === itemAssessmentId)
    ),
    duplicate_count: Math.max(0, scan.duplicate_count - 1),
  })
}

// POST /api/boxes/:boxId/scan/:scanId
// Resolves one possible-duplicate proposal from the scan review:
// - add_duplicate: creates a fresh item_assessment named after the matched item
//   (source sticker_scan), adds it to THIS box (non-draft), and fires a
//   background assessment — mirroring how the scanner handles 'new' entries.
// - skip_duplicate: just removes the proposal from the scan record.
// Body: { action, item_assessment_id } where item_assessment_id identifies the
// already-packed item the duplicate proposal points at.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ boxId: string; scanId: string }> }
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { boxId, scanId } = await params

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

  const scan = await getBoxScan(scanId)
  if (!scan || scan.box_id !== boxId) {
    return Response.json({ ok: false, error: 'Scan not found' }, { status: 404 })
  }

  let body: DuplicateActionBody
  try {
    body = (await req.json()) as DuplicateActionBody
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  if (
    (body.action !== 'add_duplicate' && body.action !== 'skip_duplicate') ||
    !body.item_assessment_id ||
    typeof body.item_assessment_id !== 'string'
  ) {
    return Response.json(
      { ok: false, error: 'action and item_assessment_id are required' },
      { status: 400 }
    )
  }

  const proposal = scan.proposed_items.find(
    (p) => p.kind === 'duplicate' && p.item_assessment_id === body.item_assessment_id
  )
  if (!proposal || proposal.kind !== 'duplicate') {
    return Response.json({ ok: false, error: 'Proposal not found' }, { status: 404 })
  }

  try {
    if (body.action === 'skip_duplicate') {
      await removeDuplicateProposal(scan, body.item_assessment_id)
      return Response.json({ ok: true })
    }

    // add_duplicate — a second physical item: fresh assessment, straight into
    // this box (the owner just confirmed it belongs here), assessed in the
    // background like the scanner's 'new' entries.
    const assessment = await saveItemAssessment({
      user_profile_id: profile.id,
      item_name: proposal.item_name,
      verdict: null,
      processing_status: ProcessingStatus.PENDING,
      source: ItemSource.STICKER_SCAN,
    })
    const boxItem = await addItemToBox(
      boxId,
      { itemAssessmentId: assessment.id, isDraft: false },
      profile.id
    )
    void assessItem(assessment.id, profile.id)
    await removeDuplicateProposal(scan, body.item_assessment_id)

    return Response.json({ ok: true, assessment, box_item: boxItem })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
