import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MessageCircle } from 'lucide-react'

import { getSession, getBoxes, getBox } from '@/mcp'
import { BoxList } from '@/components/boxes/BoxList'
import { Button } from '@/components/ui/button'

export default async function BoxesPage() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value
  if (!sessionId) redirect('/onboarding')

  const session = await getSession(sessionId)
  if (!session) redirect('/onboarding')

  const boxes = await getBoxes(session.user_profile_id)
  const boxesWithItems = await Promise.all(boxes.map((b) => getBox(b.id)))
  const boxItems = Object.fromEntries(boxesWithItems.map((b) => [b.id, b.items]))

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <h1 className="text-base font-semibold text-primary">Your Boxes</h1>
          <Link href="/chat">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <MessageCircle className="size-4" />
              Chat
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <BoxList boxes={boxes} boxItems={boxItems} />
      </main>
    </div>
  )
}
