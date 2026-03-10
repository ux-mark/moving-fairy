"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { Check, Loader2, Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type FormState = "idle" | "sending" | "sent" | "error"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [formState, setFormState] = useState<FormState>("idle")
  const [errorMessage, setErrorMessage] = useState("")

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim()) return

    setFormState("sending")
    setErrorMessage("")

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setFormState("error")
        setErrorMessage(error.message)
        return
      }

      setFormState("sent")
    } catch {
      setFormState("error")
      setErrorMessage(
        "Something went wrong sending your magic link. Please try again."
      )
    }
  }

  function handleReset() {
    setFormState("idle")
    setErrorMessage("")
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

        {formState === "sent" ? (
          /* Success state */
          <div className="flex flex-col items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
              <Check
                className="size-7 text-primary"
                strokeWidth={2.5}
                aria-hidden="true"
              />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              Magic link sent!
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              Check your inbox for an email from Moving Fairy. Click the link to
              continue.
            </p>
            <p className="text-sm font-medium text-foreground">{email}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Didn&rsquo;t get it? Check your spam folder, or{" "}
              <button
                type="button"
                onClick={handleReset}
                className={cn(
                  "font-medium text-primary underline underline-offset-2",
                  "transition-colors hover:text-primary/80",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:rounded-sm"
                )}
              >
                try again
              </button>
              .
            </p>
          </div>
        ) : (
          /* Form state */
          <>
            <h2 className="mb-2 text-xl font-semibold text-foreground">
              Sign in to continue
            </h2>
            <p className="mb-8 text-base leading-relaxed text-muted-foreground">
              Enter your email and we&rsquo;ll send you a magic link. No
              password needed&nbsp;&mdash; just click the link in your email.
            </p>

            <form
              onSubmit={handleSubmit}
              className="flex w-full flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5 text-left">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-foreground"
                >
                  Your email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={formState === "sending"}
                  placeholder="you@example.com"
                  className={cn(
                    "h-12 w-full rounded-lg border border-input bg-background px-4 text-base text-foreground",
                    "placeholder:text-muted-foreground/60",
                    "transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    "disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                />
              </div>

              {/* Error alert */}
              {formState === "error" && errorMessage && (
                <div
                  role="alert"
                  className="rounded-lg bg-destructive/10 px-4 py-3 text-left"
                >
                  <p className="text-sm text-destructive">{errorMessage}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={formState === "sending"}
                className={cn(
                  "inline-flex h-12 items-center justify-center rounded-lg",
                  "bg-primary px-8 text-base font-semibold text-primary-foreground",
                  "transition-colors hover:bg-primary/85",
                  "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  "motion-reduce:transition-none",
                  "disabled:cursor-not-allowed disabled:opacity-70"
                )}
              >
                {formState === "sending" ? (
                  <>
                    <Loader2
                      className="mr-2 size-4 animate-spin"
                      aria-hidden="true"
                    />
                    Sending...
                  </>
                ) : (
                  "Send me a magic link"
                )}
              </button>
            </form>
          </>
        )}

        {/* Back to home link */}
        <Link
          href="/"
          className={cn(
            "mt-10 text-sm text-muted-foreground",
            "transition-colors hover:text-foreground",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:rounded-sm"
          )}
        >
          &larr; Back to home
        </Link>
      </div>
    </main>
  )
}
