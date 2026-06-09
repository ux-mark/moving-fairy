'use client'

import { useEffect, useState } from 'react'

/**
 * Returns true when the viewport matches the desktop tier (≥1024px).
 *
 * Server-render returns `false` so the initial paint mirrors mobile. The
 * effect upgrades once `matchMedia` is available — there is no flash on
 * mobile, and on desktop a one-frame mobile→desktop swap is acceptable
 * (matches Next.js hydration behaviour for media-aware UI).
 *
 * Default breakpoint is `(min-width: 1024px)` — the same one our cockpit
 * layouts use.
 */
export function useIsDesktop(query = '(min-width: 1024px)'): boolean {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia(query)
    const update = () => setIsDesktop(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [query])

  return isDesktop
}
