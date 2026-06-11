'use client'

import { useEffect, useState } from 'react'

let cachedProfileId: string | undefined
let inflight: Promise<string | undefined> | null = null

async function fetchProfileId(): Promise<string | undefined> {
  try {
    const res = await fetch('/api/profile')
    if (!res.ok) return undefined
    const data = (await res.json()) as { profile?: { id?: string } }
    return data.profile?.id
  } catch {
    return undefined
  }
}

/**
 * The signed-in user's profile id — same /api/profile derivation the pages
 * use, fetched once and cached for the session so every caller (pages and
 * panel contents) passes the SAME id to the live hooks. That keeps them on
 * one shared `user_profile_id=eq.<id>` realtime channel instead of panels
 * opening an unfiltered duplicate. undefined while loading (or on failure) —
 * the live hooks then fall back to an unfiltered subscription scoped by RLS.
 */
export function useProfileId(): string | undefined {
  const [profileId, setProfileId] = useState(cachedProfileId)

  useEffect(() => {
    if (cachedProfileId !== undefined) return
    let cancelled = false
    inflight ??= fetchProfileId().then((id) => {
      cachedProfileId = id
      inflight = null
      return id
    })
    void inflight.then((id) => {
      if (!cancelled && id) setProfileId(id)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return profileId
}
