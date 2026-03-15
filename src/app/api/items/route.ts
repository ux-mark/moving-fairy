import { NextRequest } from 'next/server'
import { getItemAssessments, saveItemAssessment } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'
import { ItemSource, ProcessingStatus, Verdict } from '@/lib/constants'

// GET /api/items
// Returns all items for the authenticated user.
// Supports query params: verdict, processing_status, confirmed (boolean)
export async function GET(req: NextRequest) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const verdict = searchParams.get('verdict') as Verdict | null
  const processingStatus = searchParams.get('processing_status') as ProcessingStatus | null
  const confirmedParam = searchParams.get('confirmed')
  const confirmed = confirmedParam === null ? undefined
    : confirmedParam === 'true' ? true
    : confirmedParam === 'false' ? false
    : undefined

  try {
    const items = await getItemAssessments(profile.id, {
      ...(verdict ? { verdict } : {}),
      ...(processingStatus ? { processing_status: processingStatus } : {}),
      ...(confirmed !== undefined ? { user_confirmed: confirmed } : {}),
    })
    return Response.json(items)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}

interface CreateItemBody {
  item_name?: string
  image_url?: string
  source: 'photo_upload' | 'text_add'
}

// POST /api/items
// Creates a new item from photo upload or text description.
// Sets processing_status = 'pending', verdict = null.
export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  let body: CreateItemBody
  try {
    body = await req.json() as CreateItemBody
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.source || !['photo_upload', 'text_add'].includes(body.source)) {
    return Response.json(
      { ok: false, error: 'source is required and must be "photo_upload" or "text_add"' },
      { status: 400 }
    )
  }

  if (!body.item_name && !body.image_url) {
    return Response.json(
      { ok: false, error: 'Either item_name or image_url is required' },
      { status: 400 }
    )
  }

  try {
    const record = await saveItemAssessment({
      user_profile_id: profile.id,
      item_name: body.item_name ?? 'Untitled item',
      image_url: body.image_url ?? null,
      verdict: null,
      processing_status: ProcessingStatus.PENDING,
      source: body.source as ItemSource,
    })
    return Response.json(record, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
