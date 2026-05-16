import { redirect } from 'next/navigation'

import { getAuthenticatedProfile } from '@/lib/auth'
import { ensureShipmentsForProfile, getSettings } from '@/mcp'
import { AppLayout } from '@/components/layout/AppLayout'
import { SettingsView } from '@/components/settings/SettingsView'

export default async function SettingsPage() {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) redirect('/onboarding')

  const [settings, shipments] = await Promise.all([
    getSettings(profile.id),
    ensureShipmentsForProfile(profile.id),
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
