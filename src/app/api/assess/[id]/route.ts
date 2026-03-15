import { NextRequest } from 'next/server'
import { getItemAssessment, updateItemAssessment } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'
import { assessItem } from '@/lib/assess-item'
import { ProcessingStatus } from '@/lib/constants'

// POST /api/assess/:id
// Triggers a background assessment for a single item.
// Returns 200 immediately (fire-and-forget) — client subscribes to Realtime
// for processing_status updates.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params

  // Validate item exists and belongs to the authenticated user
  let item
  try {
    item = await getItemAssessment(id, profile.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }

  if (!item) {
    return Response.json({ ok: false, error: 'Item not found' }, { status: 404 })
  }

  // Idempotent — if already completed or in-flight, return early
  if (item.processing_status === ProcessingStatus.COMPLETED) {
    return Response.json({ ok: true, status: 'already_completed' })
  }

  if (item.processing_status === ProcessingStatus.PROCESSING) {
    return Response.json({ ok: true, status: 'already_processing' })
  }

  // Set status to 'processing' immediately so the UI can react
  try {
    await updateItemAssessment(id, { processing_status: ProcessingStatus.PROCESSING }, profile.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }

  // Fire-and-forget the background assessment — do not await
  // The client subscribes to Supabase Realtime for processing_status changes
  void assessItem(id, profile.id)

  return Response.json({ ok: true, status: 'processing' })
}
