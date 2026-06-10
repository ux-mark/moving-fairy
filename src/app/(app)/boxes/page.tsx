import { redirect } from 'next/navigation'

import { getBoxes, getItemAssessments } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'
import { BoxManagement } from '@/components/boxes/BoxManagement'
import { AppLayout } from '@/components/layout/AppLayout'
import { Verdict } from '@/lib/constants'

import styles from './boxes.module.css'

// Authed data page — never serve a cached snapshot; realtime carries updates
// from the rendered state onward.
export const dynamic = 'force-dynamic'

export default async function BoxesPage() {
  const { profile } = await getAuthenticatedProfile()
  if (!profile) redirect('/onboarding')

  const [boxes, assessments] = await Promise.all([
    getBoxes(profile.id),
    getItemAssessments(profile.id),
  ])

  const boxItems = Object.fromEntries(boxes.map((b) => [b.id, b.items]))

  // Only SHIP and CARRY assessments matter for box management
  const relevantAssessments = assessments.filter(
    (a) => a.verdict === Verdict.SHIP || a.verdict === Verdict.CARRY
  )

  return (
    <AppLayout>
      <section className={styles.main}>
        <BoxManagement
          initialBoxes={boxes}
          initialBoxItems={boxItems}
          initialAssessments={relevantAssessments}
        />
      </section>
    </AppLayout>
  )
}
