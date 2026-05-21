import { redirect } from 'next/navigation'

import { getAuthenticatedProfile } from '@/lib/auth'
import { getItemAssessments, getListingsForUser } from '@/mcp'
import { Verdict } from '@/lib/constants'
import { AppLayout } from '@/components/layout/AppLayout'
import { ListingPicker } from '@/components/selling/ListingPicker'

export default async function NewListingPage() {
  const { profile } = await getAuthenticatedProfile()
  if (!profile) redirect('/onboarding')

  const [sellItems, listings] = await Promise.all([
    getItemAssessments(profile.id, { verdict: Verdict.SELL }),
    getListingsForUser(profile.id),
  ])

  const listedItemIds = new Set(listings.map((l) => l.item_assessment_id))
  const eligible = sellItems
    .filter((item) => !listedItemIds.has(item.id))
    .map((item) => ({
      id: item.id,
      item_name: item.item_name,
      image_url: item.image_url,
      images: item.images,
      estimated_replace_cost: item.estimated_replace_cost,
      replace_currency: item.replace_currency,
    }))

  return (
    <AppLayout>
      <ListingPicker eligible={eligible} />
    </AppLayout>
  )
}
