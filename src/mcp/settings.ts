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
