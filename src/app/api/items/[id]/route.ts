import { NextRequest } from 'next/server'
import { deleteItemAssessment, getItemAssessments, updateItemAssessment } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'
import type { Verdict } from '@/lib/constants'
import { ProcessingStatus } from '@/lib/constants'

// GET /api/items/:id
// Returns a single item by ID for the authenticated user.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params

  try {
    // Fetch all items and find the matching one — ensures ownership check
    const items = await getItemAssessments(profile.id)
    const item = items.find((a) => a.id === id)
    if (!item) {
      return Response.json({ ok: false, error: 'Item not found' }, { status: 404 })
    }
    return Response.json(item)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}

interface PatchItemBody {
  item_name?: string
  verdict?: string
  advice_text?: string
  user_confirmed?: boolean
  estimated_replace_cost?: number
  replace_currency?: string
  processing_status?: ProcessingStatus
  confidence?: number
  needs_clarification?: boolean
}

// PATCH /api/items/:id
// Updates an item (verdict, user_confirmed, item_name, etc.)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params

  let body: PatchItemBody
  try {
    body = await req.json() as PatchItemBody
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  try {
    const changes: Parameters<typeof updateItemAssessment>[1] = {}

    if (body.item_name !== undefined) changes.item_name = body.item_name
    if (body.verdict !== undefined) changes.verdict = body.verdict as Verdict
    if (body.advice_text !== undefined) changes.advice_text = body.advice_text
    if (body.user_confirmed !== undefined) changes.user_confirmed = body.user_confirmed
    if (body.estimated_replace_cost !== undefined) changes.estimated_replace_cost = body.estimated_replace_cost
    if (body.replace_currency !== undefined) changes.replace_currency = body.replace_currency
    if (body.processing_status !== undefined) changes.processing_status = body.processing_status
    if (body.confidence !== undefined) changes.confidence = body.confidence
    if (body.needs_clarification !== undefined) changes.needs_clarification = body.needs_clarification

    if (Object.keys(changes).length === 0) {
      return Response.json({ ok: false, error: 'Nothing to update' }, { status: 400 })
    }

    const item = await updateItemAssessment(id, changes, profile.id)
    return Response.json(item)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}

// DELETE /api/items/:id
// Deletes an item and all associated data.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params

  try {
    await deleteItemAssessment(id, profile.id)
    return Response.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    const status = message === 'Item assessment not found' ? 404
      : message === 'Not authorised to delete this item' ? 403
      : 500
    return Response.json({ ok: false, error: message }, { status })
  }
}
