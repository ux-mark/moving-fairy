import { redirect } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { MagicLinkForm } from '@/components/auth/MagicLinkForm'
import styles from './page.module.css'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/chat')
  }

  return (
    <main className={styles.main}>
      <div className={styles.inner}>
        {/* Wordmark */}
        <div className={styles.wordmark}>
          <Sparkles
            className={styles.wordmarkIcon}
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <h1 className={styles.wordmarkTitle}>
            Moving Fairy
          </h1>
        </div>

        {/* Tagline */}
        <p className={styles.tagline}>
          Your fairy to help you with your move abroad.
        </p>

        {/* Aisling intro */}
        <blockquote className={styles.intro}>
          <p>
            &ldquo;Hi, I&rsquo;m Aisling. I&rsquo;ve helped hundreds of people
            figure out what to bring, what to sell, and what to leave behind when
            they move overseas. Let&rsquo;s sort through it together&nbsp;&mdash;
            I&rsquo;ll tell you exactly what I&rsquo;d do.&rdquo;
          </p>
        </blockquote>

        {/* Email form — handles both new and returning users */}
        <MagicLinkForm />
      </div>
    </main>
  )
}
