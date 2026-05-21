import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { EnquiryStatus } from '@/lib/constants'
import type { Enquiry } from '@/types/database'

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export type CreateEnquiryInput = {
  listing_ids: string[]
  buyer_email: string
  buyer_name?: string | null
  message: string
  subtotal_cents?: number | null
  discount_percent?: number | null
  total_cents?: number | null
}

/**
 * Public buyer endpoint — invoked from `POST /api/enquiries`.
 *
 * RLS note: the `enquiry` table has NO insert policy, so anon/auth inserts
 * are blocked at the table level. This function uses the service-role client
 * to bypass RLS — that is intentional and the only safe path for buyer
 * enquiries. Validate inputs aggressively here because the table-level guard
 * isn't going to catch malformed data.
 */
export async function createEnquiry(input: CreateEnquiryInput): Promise<Enquiry> {
  if (!input.listing_ids || input.listing_ids.length === 0) {
    throw new Error('At least one listing is required')
  }
  if (!input.buyer_email || !input.buyer_email.includes('@')) {
    throw new Error('A valid buyer email is required')
  }
  if (!input.message || input.message.trim().length === 0) {
    throw new Error('Enquiry message cannot be empty')
  }

  const supabase = getAdminClient()

  const { data: listings, error: lErr } = await supabase
    .from('listing')
    .select('id, user_profile_id')
    .in('id', input.listing_ids)

  if (lErr) throw new Error(lErr.message)
  if (!listings || listings.length === 0) throw new Error('No matching listings found')
  if (listings.length !== input.listing_ids.length) {
    throw new Error('One or more listings could not be found')
  }

  // All listings in a bundle must share the same owner — we route the
  // enquiry to a single owner inbox.
  const ownerIds = new Set(listings.map((l) => l.user_profile_id as string))
  if (ownerIds.size > 1) {
    throw new Error('All listings in an enquiry must belong to the same seller')
  }
  const firstListing = listings[0]
  if (!firstListing) throw new Error('No matching listings found')
  const userProfileId = firstListing.user_profile_id as string

  const { data, error } = await supabase
    .from('enquiry')
    .insert({
      user_profile_id: userProfileId,
      listing_ids: input.listing_ids,
      buyer_email: input.buyer_email,
      buyer_name: input.buyer_name ?? null,
      message: input.message,
      subtotal_cents: input.subtotal_cents ?? null,
      discount_percent: input.discount_percent ?? null,
      total_cents: input.total_cents ?? null,
      status: EnquiryStatus.NEW,
    })
    .select()
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to create enquiry')
  return data as Enquiry
}

export async function getEnquiriesForUser(
  userProfileId: string,
  status?: EnquiryStatus,
): Promise<Enquiry[]> {
  const supabase = getAdminClient()
  let query = supabase
    .from('enquiry')
    .select('*')
    .eq('user_profile_id', userProfileId)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Enquiry[]
}

export async function updateEnquiryStatus(
  enquiryId: string,
  status: EnquiryStatus,
): Promise<Enquiry> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('enquiry')
    .update({ status })
    .eq('id', enquiryId)
    .select()
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to update enquiry status')
  return data as Enquiry
}
