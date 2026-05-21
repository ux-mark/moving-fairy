import { redirect } from 'next/navigation'

import { getAuthenticatedProfile } from '@/lib/auth'
import {
  getBoxes,
  getItemAssessments,
  getListingsForUser,
} from '@/mcp'
import { AppLayout } from '@/components/layout/AppLayout'
import { ItemsView } from '@/components/items/ItemsView'
import { safeMcp } from '@/lib/safe-mcp'

export default async function ItemsPage() {
  const { profile } = await getAuthenticatedProfile()
  if (!profile) redirect('/onboarding')

  // safeMcp lets the page render an empty state if the listing/box tables
  // aren't migrated yet, instead of throwing a 500.
  const [items, listings, boxes] = await Promise.all([
    safeMcp(() => getItemAssessments(profile.id), []),
    safeMcp(() => getListingsForUser(profile.id), []),
    safeMcp(() => getBoxes(profile.id), []),
  ])

  // Map item_assessment_id → its listing (for "to sell" / "done" SELL routing)
  const listingByItem = Object.fromEntries(
    listings.map((l) => [l.item_assessment_id, l]),
  )

  // Set of item_assessment_ids that already live in any box
  const packedItemIds = new Set<string>()
  for (const box of boxes) {
    for (const bi of box.items) {
      if (bi.item_assessment_id) packedItemIds.add(bi.item_assessment_id)
    }
  }

  // Build the lightweight rows the client component needs to bucket items.
  const itemsWithContext = items.map((item) => ({
    item,
    listing_status: listingByItem[item.id]?.listing_status ?? null,
    is_packed: packedItemIds.has(item.id),
  }))

  return (
    <AppLayout>
      <ItemsView profileId={profile.id} initialItems={itemsWithContext} />
    </AppLayout>
  )
}
