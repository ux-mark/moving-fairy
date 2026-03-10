"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { Button } from "@thefairies/design-system/components"
import { createClient } from "@/lib/supabase/client"
import styles from "./SignOutButton.module.css"

export function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleSignOut}
      title="Sign out"
    >
      <LogOut className={styles.icon} aria-hidden="true" />
      <span className={styles.label}>Sign out</span>
    </Button>
  )
}
