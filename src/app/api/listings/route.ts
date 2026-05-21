import { NextRequest } from 'next/server'
import { createListing, getListingsForUserWithItem } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'

// GET /api/listings — owner's listings with item join
export async function GET() {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const listings = await getListingsForUserWithItem(profile.id)
    return Response.json(listings)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}

interface CreateListingBody {
  item_assessment_id: string
}

// POST /api/listings — create a draft listing for a SELL item
export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  let body: CreateListingBody
  try {
    body = (await req.json()) as CreateListingBody
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.item_assessment_id) {
    return Response.json({ ok: false, error: 'item_assessment_id is required' }, { status: 400 })
  }

  try {
    const listing = await createListing({
      user_profile_id: profile.id,
      item_assessment_id: body.item_assessment_id,
    })
    return Response.json(listing, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 400 })
  }
}
