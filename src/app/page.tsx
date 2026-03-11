import { redirect } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { MagicLinkForm } from '@/components/auth/MagicLinkForm'
import { AuthCard } from '@thefairies/design-system/components'
import styles from './page.module.css'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/inventory')
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
            &ldquo;I&rsquo;m Aisling. Tell me what you own and
            I&rsquo;ll tell you what to bring, sell, or leave
            behind&nbsp;&mdash; item by item.&rdquo;
          </p>
        </blockquote>

        {/* Email form wrapped in DS AuthCard */}
        <AuthCard
          title="Sign in to continue"
          subtitle="We'll send you a magic link — no password needed."
        >
          <MagicLinkForm />
        </AuthCard>
      </div>
    </main>
  )
}
