import { notFound, redirect } from 'next/navigation'

import { getAuthenticatedProfile } from '@/lib/auth'
import { getItemAssessment, getListing } from '@/mcp'
import { AppLayout } from '@/components/layout/AppLayout'
import { ListingEditor } from '@/components/selling/ListingEditor'

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { profile } = await getAuthenticatedProfile()
  if (!profile) redirect('/onboarding')

  const { id } = await params
  const listing = await getListing(id)
  if (!listing || listing.user_profile_id !== profile.id) notFound()

  const item = await getItemAssessment(listing.item_assessment_id, profile.id)
  if (!item) notFound()

  return (
    <AppLayout>
      <ListingEditor listing={listing} item={item} />
    </AppLayout>
  )
}
