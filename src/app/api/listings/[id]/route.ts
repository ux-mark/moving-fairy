import { NextRequest } from 'next/server'
import { deleteListing, getListing, updateListing } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'
import {
  ListingCondition,
  ListingStatus,
  ListingVisibility,
} from '@/lib/constants'

interface PatchListingBody {
  asking_price?: number | null
  currency?: string
  condition?: string | null
  brand?: string | null
  model_name?: string | null
  dimensions?: string | null
  included?: string | null
  details?: string | null
  listing_status?: string
  visibility?: string
}

async function ownedListingOr404(id: string, userProfileId: string) {
  const listing = await getListing(id)
  if (!listing) return null
  if (listing.user_profile_id !== userProfileId) return null
  return listing
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const listing = await ownedListingOr404(id, profile.id)
  if (!listing) {
    return Response.json({ ok: false, error: 'Listing not found' }, { status: 404 })
  }
  return Response.json(listing)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const existing = await ownedListingOr404(id, profile.id)
  if (!existing) {
    return Response.json({ ok: false, error: 'Listing not found' }, { status: 404 })
  }

  let body: PatchListingBody
  try {
    body = (await req.json()) as PatchListingBody
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  const changes: Parameters<typeof updateListing>[1] = {}

  if (body.asking_price !== undefined) changes.asking_price = body.asking_price
  if (body.currency !== undefined) changes.currency = body.currency
  if (body.condition !== undefined) {
    if (body.condition !== null) {
      const valid = Object.values(ListingCondition) as string[]
      if (!valid.includes(body.condition)) {
        return Response.json({ ok: false, error: 'Invalid condition' }, { status: 400 })
      }
    }
    changes.condition = body.condition as ListingCondition | null
  }
  if (body.brand !== undefined) changes.brand = body.brand
  if (body.model_name !== undefined) changes.model_name = body.model_name
  if (body.dimensions !== undefined) changes.dimensions = body.dimensions
  if (body.included !== undefined) changes.included = body.included
  if (body.details !== undefined) changes.details = body.details

  if (body.listing_status !== undefined) {
    const valid = Object.values(ListingStatus) as string[]
    if (!valid.includes(body.listing_status)) {
      return Response.json({ ok: false, error: 'Invalid listing status' }, { status: 400 })
    }
    changes.listing_status = body.listing_status as ListingStatus
  }
  if (body.visibility !== undefined) {
    const valid = Object.values(ListingVisibility) as string[]
    if (!valid.includes(body.visibility)) {
      return Response.json({ ok: false, error: 'Invalid visibility' }, { status: 400 })
    }
    changes.visibility = body.visibility as ListingVisibility
  }

  if (Object.keys(changes).length === 0) {
    return Response.json({ ok: false, error: 'Nothing to update' }, { status: 400 })
  }

  try {
    const updated = await updateListing(id, changes)
    return Response.json(updated)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const existing = await ownedListingOr404(id, profile.id)
  if (!existing) {
    return Response.json({ ok: false, error: 'Listing not found' }, { status: 404 })
  }

  try {
    await deleteListing(id)
    return Response.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
