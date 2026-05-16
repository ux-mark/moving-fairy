import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { ListingCondition, ListingStatus, ListingVisibility, Verdict } from '@/lib/constants'
import { buildSlug } from '@/lib/utils'
import type { ItemAssessment, Listing } from '@/types/database'

/** Service-role client — bypasses RLS. Used for owner-scoped writes / reads. */
function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Anon client — honours RLS. Used for public reads where we want the
 * `visibility='public' AND listing_status='published'` policy gate to do the
 * filtering, so any bug in our where-clauses can't accidentally leak a draft.
 */
function getAnonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// ─── Create ────────────────────────────────────────────────────────────────

export type CreateListingInput = {
  user_profile_id: string
  item_assessment_id: string
  asking_price?: number | null
  currency?: string
  condition?: ListingCondition | null
  brand?: string | null
  model_name?: string | null
  dimensions?: string | null
  included?: string | null
  details?: string | null
}

/**
 * Create a Listing for an item that Aisling has verdict-tagged as SELL.
 * Slug is derived from the item name + a 4-char random suffix.
 */
export async function createListing(input: CreateListingInput): Promise<Listing> {
  const supabase = getAdminClient()

  // Validate the linked item is owned by this user AND has verdict SELL.
  const { data: assessment, error: aErr } = await supabase
    .from('item_assessment')
    .select('id, item_name, verdict, user_profile_id')
    .eq('id', input.item_assessment_id)
    .single()

  if (aErr || !assessment) throw new Error('Item assessment not found')
  if (assessment.user_profile_id !== input.user_profile_id) {
    throw new Error('Item assessment does not belong to this user')
  }
  if (assessment.verdict !== Verdict.SELL) {
    throw new Error(
      `Cannot list item with verdict ${assessment.verdict ?? 'null'}. Only SELL items can be listed.`,
    )
  }

  const slug = buildSlug(assessment.item_name)

  const { data, error } = await supabase
    .from('listing')
    .insert({
      user_profile_id: input.user_profile_id,
      item_assessment_id: input.item_assessment_id,
      slug,
      asking_price: input.asking_price ?? null,
      currency: input.currency ?? 'USD',
      condition: input.condition ?? null,
      brand: input.brand ?? null,
      model_name: input.model_name ?? null,
      dimensions: input.dimensions ?? null,
      included: input.included ?? null,
      details: input.details ?? null,
      listing_status: ListingStatus.DRAFT,
      visibility: ListingVisibility.UNLISTED,
    })
    .select()
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to create listing')
  return data as Listing
}

// ─── Read (owner) ───────────────────────────────────────────────────────────

export async function getListing(listingId: string): Promise<Listing | null> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('listing')
    .select('*')
    .eq('id', listingId)
    .single()
  if (error || !data) return null
  return data as Listing
}

export async function getListingsForUser(userProfileId: string): Promise<Listing[]> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('listing')
    .select('*')
    .eq('user_profile_id', userProfileId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Listing[]
}

export type OwnerListing = Listing & {
  item_assessment: Pick<
    ItemAssessment,
    'id' | 'item_name' | 'item_description' | 'images' | 'image_url' | 'verdict'
  > | null
}

/**
 * Owner-facing list: same as getListingsForUser but joins in just enough of
 * the linked item_assessment to render a card (name, first image, verdict).
 */
export async function getListingsForUserWithItem(userProfileId: string): Promise<OwnerListing[]> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('listing')
    .select('*, item_assessment:item_assessment_id (id, item_name, item_description, images, image_url, verdict)')
    .eq('user_profile_id', userProfileId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as OwnerListing[]
}

// ─── Read (public, RLS-gated) ───────────────────────────────────────────────

export type PublicListing = Listing & {
  item_assessment: Pick<ItemAssessment, 'id' | 'item_name' | 'item_description' | 'images' | 'image_url'> | null
}

/**
 * Public-facing single listing lookup. Uses anon client so RLS enforces the
 * "public + published" gate — if the policy ever drifts, this query returns
 * null rather than leaking a draft.
 */
export async function getListingBySlug(slug: string): Promise<PublicListing | null> {
  const supabase = getAnonClient()
  const { data, error } = await supabase
    .from('listing')
    .select('*, item_assessment:item_assessment_id (id, item_name, item_description, images, image_url)')
    .eq('slug', slug)
    .eq('visibility', ListingVisibility.PUBLIC)
    .eq('listing_status', ListingStatus.PUBLISHED)
    .maybeSingle()

  if (error || !data) return null
  return data as PublicListing
}

/** Public-facing browse — includes published and reserved (still visible, marked unavailable in UI). */
export async function getPublishedListings(): Promise<PublicListing[]> {
  const supabase = getAnonClient()
  const { data, error } = await supabase
    .from('listing')
    .select('*, item_assessment:item_assessment_id (id, item_name, item_description, images, image_url)')
    .eq('visibility', ListingVisibility.PUBLIC)
    .in('listing_status', [ListingStatus.PUBLISHED, ListingStatus.RESERVED])
    .order('published_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as PublicListing[]
}

// ─── Update ────────────────────────────────────────────────────────────────

type ListingUpdatable = Partial<Pick<Listing,
  | 'asking_price'
  | 'currency'
  | 'condition'
  | 'brand'
  | 'model_name'
  | 'dimensions'
  | 'included'
  | 'details'
  | 'listing_status'
  | 'visibility'
  | 'published_at'
>>

/**
 * Owner-scoped update. When transitioning into `published`, default to
 * `public` visibility and stamp `published_at = now()` unless the caller
 * explicitly overrode those fields in the same payload.
 */
export async function updateListing(
  listingId: string,
  changes: ListingUpdatable,
): Promise<Listing> {
  const supabase = getAdminClient()

  const patch: Record<string, unknown> = { ...changes, updated_at: new Date().toISOString() }

  if (changes.listing_status === ListingStatus.PUBLISHED) {
    if (!('visibility' in changes)) {
      patch.visibility = ListingVisibility.PUBLIC
    }
    if (!('published_at' in changes)) {
      patch.published_at = new Date().toISOString()
    }
  }

  const { data, error } = await supabase
    .from('listing')
    .update(patch)
    .eq('id', listingId)
    .select()
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to update listing')
  return data as Listing
}

/**
 * Mark a listing sold and propagate to the linked item_assessment so the
 * sold state is visible wherever the underlying item is rendered.
 */
export async function markListingSold(listingId: string): Promise<Listing> {
  const supabase = getAdminClient()

  const listing = await getListing(listingId)
  if (!listing) throw new Error('Listing not found')

  const { data, error } = await supabase
    .from('listing')
    .update({
      listing_status: ListingStatus.SOLD,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId)
    .select()
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to mark listing sold')

  // Propagate to item_assessment — keep user_confirmed=true so the owner UI
  // shows this as a settled decision.
  await supabase
    .from('item_assessment')
    .update({ user_confirmed: true, updated_at: new Date().toISOString() })
    .eq('id', listing.item_assessment_id)

  return data as Listing
}

/**
 * Hard-delete the listing row. The linked item_assessment is preserved so the
 * SELL decision and any history remain in place — only the marketplace
 * surface is removed.
 */
export async function deleteListing(listingId: string): Promise<void> {
  const supabase = getAdminClient()
  const { error } = await supabase.from('listing').delete().eq('id', listingId)
  if (error) throw new Error(error.message)
}

/** Temporarily hide a listing from public browse without changing its status. */
export async function unpublishListing(listingId: string): Promise<Listing> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('listing')
    .update({
      visibility: ListingVisibility.UNLISTED,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId)
    .select()
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to unpublish listing')
  return data as Listing
}
