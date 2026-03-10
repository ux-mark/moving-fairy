import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

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

        {/* Primary CTA */}
        <Link
          href="/auth/login"
          className={cn(
            'inline-flex h-12 items-center justify-center rounded-lg',
            'bg-primary px-8 text-base font-semibold text-primary-foreground',
            'transition-colors hover:bg-primary/85',
            'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
            'motion-reduce:transition-none',
            'min-w-[200px]'
          )}
        >
          Let&rsquo;s get started
        </Link>

        {/* Sign in link */}
        <p className="mt-4 text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            href="/auth/login"
            className={cn(
              'font-medium text-primary underline underline-offset-2',
              'transition-colors hover:text-primary/80',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:rounded-sm'
            )}
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
