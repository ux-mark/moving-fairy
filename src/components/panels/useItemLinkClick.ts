'use client'

import { useCallback } from 'react'

import { originSideFromTrigger } from './placement'
import { usePanels } from './PanelProvider'

/**
 * Click interceptor for `<Link href="/decisions/<id>…">` item links: a plain
 * left-click opens the item panel in place instead of navigating, while
 * cmd/ctrl/shift-click and middle-click keep their open-in-new-tab behaviour
 * (the legacy route redirects to the `?item=` deep link).
 */
export function useItemLinkClick(): (itemId: string) => (e: React.MouseEvent) => void {
  const { openPanel } = usePanels()
  return useCallback(
    (itemId: string) => (e: React.MouseEvent) => {
      e.stopPropagation()
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
      e.preventDefault()
      openPanel({ kind: 'item', entityId: itemId, originSide: originSideFromTrigger() })
    },
    [openPanel]
  )
}
