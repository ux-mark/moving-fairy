import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Home() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value
  if (sessionId) {
    redirect('/chat')
  }
  redirect('/onboarding')
}
