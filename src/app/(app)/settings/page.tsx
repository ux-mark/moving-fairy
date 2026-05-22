import { redirect } from 'next/navigation'

import { getAuthenticatedProfile } from '@/lib/auth'
import { ensureShipmentsForProfile, getSettings } from '@/mcp'
import { AppLayout } from '@/components/layout/AppLayout'
import { SettingsView } from '@/components/settings/SettingsView'
import { safeMcp } from '@/lib/safe-mcp'
import type { SellerSettings } from '@/types/database'

// Synthetic stand-in used only when the seller_settings table is not yet
// migrated — keeps the page renderable so the user can see the layout while
// the underlying schema is pending. Once the migration is applied, getSettings
// returns the real row and this fallback is never used.
function fallbackSettings(profileId: string): SellerSettings {
  const now = new Date().toISOString()
  return {
    id: 'pending',
    user_profile_id: profileId,
    currency: 'USD',
    seller_display_name: null,
    contact_email: null,
    pickup_location_copy: null,
    discount_tiers: [
      { min: 3, max: 4, percent: 10 },
      { min: 5, max: 30, percent: 20 },
      { min: 31, max: null, percent: 30 },
    ],
    biosecurity_destination_preset: null,
    default_collection_name: 'For sale',
    default_condition: null,
    categories: [
      'Plants',
      'Kitchen & appliances',
      'Furniture',
      'Electronics',
      'Tools & hardware',
      'Home & decor',
      'Outdoor & garden',
      'Other',
    ],
    created_at: now,
    updated_at: now,
  }
}

export default async function SettingsPage() {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) redirect('/onboarding')

  const [settings, shipments] = await Promise.all([
    safeMcp(() => getSettings(profile.id), fallbackSettings(profile.id)),
    safeMcp(() => ensureShipmentsForProfile(profile.id), []),
  ])

  return (
    <AppLayout>
      <SettingsView
        email={user.email ?? ''}
        settings={settings}
        shipments={shipments}
        arrivalCountry={profile.arrival_country}
        onwardCountry={profile.onward_country}
      />
    </AppLayout>
  )
}
