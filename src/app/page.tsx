import { redirect } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { MagicLinkForm } from '@/components/auth/MagicLinkForm'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/chat')
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        {/* Wordmark */}
        <div className="mb-8 flex items-center gap-2.5">
          <Sparkles
            className="size-7 text-accent"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Moving Fairy
          </h1>
        </div>

        {/* Tagline */}
        <p className="mb-8 text-lg font-medium text-muted-foreground">
          Your fairy to help you with your move abroad.
        </p>

        {/* Aisling intro */}
        <blockquote className="mb-10 rounded-xl bg-card px-6 py-5 text-base leading-relaxed text-foreground shadow-sm ring-1 ring-border">
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
