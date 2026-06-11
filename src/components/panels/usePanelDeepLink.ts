'use client'

import { useCallback, useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import {
  INITIAL_DEEP_LINK_STATE,
  nextDeepLinkStep,
  type DeepLinkState,
} from './deepLink'
import { panelId } from './panelsReducer'
import { usePanels } from './PanelProvider'
import type { PanelKind, PanelSide } from './types'

/**
 * Two-way sync between a search param and a panel kind (spec §3 deep links):
 *
 * - `?{param}=<id>` on load (or via a shared link) opens the panel.
 * - `open(id, originSide)` — for click handlers — opens the panel AND pushes
 *   the param (router.push) so the URL stays shareable and browser Back
 *   closes the panel (param disappears → the state machine closes it).
 * - Closing the panel removes the param with router.replace — cleanup
 *   shouldn't add history entries.
 */
export function usePanelDeepLink(
  kind: PanelKind,
  param: string
): { open: (entityId: string, originSide?: PanelSide | undefined) => void } {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { panels, openPanel, closePanel } = usePanels()

  const value = searchParams.get(param)
  const stateRef = useRef<DeepLinkState>(INITIAL_DEEP_LINK_STATE)

  useEffect(() => {
    const relevant = value ?? stateRef.current.handled
    const isOpen =
      relevant !== null && panels.some((p) => p.id === panelId(kind, relevant))
    const step = nextDeepLinkStep(stateRef.current, value, isOpen)
    stateRef.current = step.state
    if (step.action === 'open') {
      openPanel({ kind, entityId: step.entityId })
    } else if (step.action === 'close') {
      // Param removed externally (browser Back) — close the panel.
      closePanel(panelId(kind, step.entityId))
    } else if (step.action === 'clearParam') {
      const params = new URLSearchParams(searchParams.toString())
      params.delete(param)
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }
  }, [value, panels, kind, param, openPanel, closePanel, router, pathname, searchParams])

  const open = useCallback(
    (entityId: string, originSide?: PanelSide | undefined) => {
      // Mark handled before the URL updates so the effect doesn't double-open.
      stateRef.current = { handled: entityId, wasOpen: false }
      openPanel({ kind, entityId, ...(originSide ? { originSide } : {}) })
      const params = new URLSearchParams(searchParams.toString())
      params.set(param, entityId)
      // push (not replace): opening by click creates a history entry, so
      // browser Back closes the panel instead of leaving the page.
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [kind, param, openPanel, router, pathname, searchParams]
  )

  return { open }
}
