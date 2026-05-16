import { redirect } from 'next/navigation'

import { getAuthenticatedProfile } from '@/lib/auth'
import { ensureShipmentsForProfile, getManifest } from '@/mcp'
import { AppLayout } from '@/components/layout/AppLayout'
import { ItineraryView } from '@/components/itinerary/ItineraryView'

export default async function ItineraryPage({
  searchParams,
}: {
  searchParams: Promise<{ leg?: string }>
}) {
  const { profile } = await getAuthenticatedProfile()
  if (!profile) redirect('/onboarding')

  // Make sure the shipment rows exist (idempotent).
  const shipments = await ensureShipmentsForProfile(profile.id)

  const { leg } = await searchParams
  const requestedId = leg ?? null
  const active =
    shipments.find((s) => s.id === requestedId) ?? shipments[0] ?? null

  // Build the manifest for the active leg if there is one.
  const manifest = active ? await getManifest(active.id) : null

  return (
    <AppLayout>
      <ItineraryView shipments={shipments} activeShipmentId={active?.id ?? null} manifest={manifest} />
    </AppLayout>
  )
}
