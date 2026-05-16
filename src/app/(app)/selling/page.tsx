import { redirect } from 'next/navigation'

import { getAuthenticatedProfile } from '@/lib/auth'
import { getListingsForUserWithItem, getItemAssessments } from '@/mcp'
import { Verdict } from '@/lib/constants'
import { AppLayout } from '@/components/layout/AppLayout'
import { SellingList } from '@/components/selling/SellingList'

export default async function SellingPage() {
  const { profile } = await getAuthenticatedProfile()
  if (!profile) redirect('/onboarding')

  const [listings, assessments] = await Promise.all([
    getListingsForUserWithItem(profile.id),
    getItemAssessments(profile.id, { verdict: Verdict.SELL }),
  ])

  // Items eligible for a new draft listing = SELL items without a listing row yet.
  const listedItemIds = new Set(listings.map((l) => l.item_assessment_id))
  const eligibleCount = assessments.filter((a) => !listedItemIds.has(a.id)).length

  return (
    <AppLayout>
      <SellingList listings={listings} eligibleCount={eligibleCount} />
    </AppLayout>
  )
}
