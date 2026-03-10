"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

export function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      title="Sign out"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5",
        "text-xs text-muted-foreground",
        "transition-colors hover:bg-muted hover:text-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      )}
    >
      <LogOut className="size-3.5" aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">Sign out</span>
    </button>
  )
}
