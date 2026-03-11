import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { Button } from '@thefairies/design-system/components'

import { getSession, getBoxes, getBox, getItemAssessments } from '@/mcp'
import { BoxManagement } from '@/components/boxes/BoxManagement'
import { Verdict } from '@/lib/constants'

import styles from './boxes.module.css'

export default async function BoxesPage() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value
  if (!sessionId) redirect('/onboarding')

  const session = await getSession(sessionId)
  if (!session) redirect('/onboarding')

  const [boxes, assessments] = await Promise.all([
    getBoxes(session.user_profile_id),
    getItemAssessments(session.user_profile_id),
  ])

  const boxesWithItems = await Promise.all(boxes.map((b) => getBox(b.id)))
  const boxItems = Object.fromEntries(boxesWithItems.map((b) => [b.id, b.items]))

  // Only SHIP and CARRY assessments matter for box management
  const relevantAssessments = assessments.filter(
    (a) => a.verdict === Verdict.SHIP || a.verdict === Verdict.CARRY
  )

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <h1 className={styles.pageTitle}>Your Boxes</h1>
          <Link href="/chat">
            <Button variant="ghost" size="sm">
              <MessageCircle style={{ width: 16, height: 16 }} />
              Chat
            </Button>
          </Link>
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
  )
}
