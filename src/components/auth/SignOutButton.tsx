"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { Button } from "@thefairies/design-system/components"
import { createClient } from "@/lib/supabase/client"

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
      <LogOut className="size-3.5" aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">Sign out</span>
    </Button>
  )
}
