"use client"

import { FormEvent, useState } from "react"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@thefairies/design-system/components"
import { createClient } from "@/lib/supabase/client"
import styles from "./MagicLinkForm.module.css"

type FormState = "idle" | "sending" | "sent" | "error"

export function MagicLinkForm() {
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

  if (formState === "sent") {
    return (
      <div className={styles.sentWrapper}>
        <div className={styles.sentIcon}>
          <Check
            className="size-7"
            style={{ color: "var(--color-primary)" }}
            strokeWidth={2.5}
            aria-hidden="true"
          />
        </div>
        <h2 className={styles.sentTitle}>Magic link sent!</h2>
        <p className={styles.sentDescription}>
          Check your inbox for an email from Moving Fairy. Click the link to
          continue.
        </p>
        <p className={styles.sentEmail}>{email}</p>
        <p className={styles.sentNote}>
          Didn&rsquo;t get it? Check your spam folder, or{" "}
          <button
            type="button"
            onClick={handleReset}
            className={styles.retryButton}
          >
            try again
          </button>
          .
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.fieldGroup}>
        <label htmlFor="email" className={styles.label}>
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
          className={styles.input}
        />
      </div>

      {formState === "error" && errorMessage && (
        <div role="alert" className={styles.errorBanner}>
          <p className={styles.errorText}>{errorMessage}</p>
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={formState === "sending"}
        className={styles.submitButton ?? ""}
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
      </Button>
    </form>
  )
}
