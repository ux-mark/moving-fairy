import { redirect } from 'next/navigation'

import { getBoxes, getItemAssessments } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'
import { BoxManagement } from '@/components/boxes/BoxManagement'
import { AppLayout } from '@/components/layout/AppLayout'
import { Verdict } from '@/lib/constants'

import styles from './boxes.module.css'

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
      <div className={styles.pageContent}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <h1 className={styles.pageTitle}>Your boxes</h1>
          </div>
        </header>

        <main className={styles.main}>
          <BoxManagement
            initialBoxes={boxes}
            initialBoxItems={boxItems}
            initialAssessments={relevantAssessments}
          />
        </main>
      </div>
    </AppLayout>
  )
}
