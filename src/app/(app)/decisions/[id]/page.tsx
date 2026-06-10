import { redirect } from 'next/navigation'

/**
 * Legacy full-page item route — the panel system superseded it (spec §3).
 * Kept as a thin redirect so old links and bookmarks keep working: the
 * decisions page opens the item panel from the `?item=` deep link.
 */
export default async function ItemDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/decisions?item=${encodeURIComponent(id)}`)
}
