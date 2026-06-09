import { AppLayout } from '@/components/layout/AppLayout'
import { PageSkeleton } from '@/components/layout/PageSkeleton'

// Instant loading boundary: navigation shows the shell + a skeleton immediately
// while the server data resolves, instead of freezing on the previous page.
export default function Loading() {
  return (
    <AppLayout>
      <PageSkeleton />
    </AppLayout>
  )
}
