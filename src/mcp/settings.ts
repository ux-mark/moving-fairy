import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { DiscountTier, SellerSettings } from '@/types/database'

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Default discount tiers used when a seller_settings row is auto-created.
 * Mirrors the SQL default in the migration so the in-app behaviour matches
 * what Postgres would have written.
 */
const DEFAULT_DISCOUNT_TIERS: DiscountTier[] = [
  { min: 3, max: 4, percent: 10 },
  { min: 5, max: 30, percent: 20 },
  { min: 31, max: null, percent: 30 },
]

/**
 * Default master list of listing categories. Mirrors the SQL default in
 * 20260521000002_listing_categories.sql so a row inserted from this code
 * path matches what Postgres would write.
 */
const DEFAULT_CATEGORIES: string[] = [
  'Plants',
  'Kitchen & appliances',
  'Furniture',
  'Electronics',
  'Tools & hardware',
  'Home & decor',
  'Outdoor & garden',
  'Other',
]

/**
 * Read seller settings for a user. If the row doesn't exist yet, insert a
 * default row and return it — common Supabase pattern for 1:1 child tables
 * with sensible defaults.
 */
export async function getSettings(userProfileId: string): Promise<SellerSettings> {
  const supabase = getAdminClient()

  const { data: existing, error: fetchErr } = await supabase
    .from('seller_settings')
    .select('*')
    .eq('user_profile_id', userProfileId)
    .maybeSingle()

  if (fetchErr) throw new Error(fetchErr.message)
  if (existing) return existing as SellerSettings

  const { data: created, error: insertErr } = await supabase
    .from('seller_settings')
    .insert({
      user_profile_id: userProfileId,
      currency: 'USD',
      discount_tiers: DEFAULT_DISCOUNT_TIERS,
      default_collection_name: 'For sale',
      default_condition: null,
      categories: DEFAULT_CATEGORIES,
    })
    .select()
    .single()

  if (insertErr || !created) {
    throw new Error(insertErr?.message ?? 'Failed to create default seller settings')
  }
  return created as SellerSettings
}

type SellerSettingsUpdatable = Partial<Pick<SellerSettings,
  | 'currency'
  | 'seller_display_name'
  | 'contact_email'
  | 'pickup_location_copy'
  | 'discount_tiers'
  | 'biosecurity_destination_preset'
  | 'default_collection_name'
  | 'default_condition'
  | 'categories'
>>

export async function updateSettings(
  userProfileId: string,
  changes: SellerSettingsUpdatable,
): Promise<SellerSettings> {
  const supabase = getAdminClient()

  // Ensure a row exists before patching — keeps callers from having to
  // remember the read-then-write dance.
  await getSettings(userProfileId)

  const { data, error } = await supabase
    .from('seller_settings')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('user_profile_id', userProfileId)
    .select()
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to update seller settings')
  return data as SellerSettings
}

/**
 * Append a category to the seller's master list if it isn't already present
 * (case-insensitive match). Idempotent — calling with an existing name is a
 * no-op. Used by Aisling's persistence path when she proposes a label that
 * doesn't already exist on the seller's list.
 */
export async function addCategory(
  userProfileId: string,
  name: string,
): Promise<SellerSettings> {
  const trimmed = name.trim()
  if (!trimmed) {
    // Nothing to do — return current settings unchanged.
    return getSettings(userProfileId)
  }

  const settings = await getSettings(userProfileId)
  const current = settings.categories ?? []

  const alreadyPresent = current.some(
    (existing) => existing.toLowerCase() === trimmed.toLowerCase(),
  )
  if (alreadyPresent) return settings

  return updateSettings(userProfileId, { categories: [...current, trimmed] })
}
