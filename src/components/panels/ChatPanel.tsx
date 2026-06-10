'use client'

import { useEffect, useState } from 'react'

import { PerItemChat } from '@/components/decisions/PerItemChat'
import { useItems } from '@/lib/hooks/useItems'
import { proxyImageUrl } from '@/lib/storage-url'

import { subscribeChatRefresh } from './chatRefreshBus'
import { usePanels } from './PanelProvider'
import type { PanelContentProps } from './registry'
import styles from './ChatPanel.module.css'

/**
 * Per-item chat in its own panel (spec §3) — independently movable and
 * minimisable from its parent ItemPanel. entityId is the item id. The Panel
 * chrome carries the title, so PerItemChat renders headerless (the same
 * hosting FloatingChatPanel used before it was deleted).
 */
export function ChatPanel({ panelId, entityId }: PanelContentProps) {
  const { setPanelTitle } = usePanels()
  const { items } = useItems()
  const item = items.find((i) => i.id === entityId)
  const itemName = item?.item_name || 'this item'

  useEffect(() => {
    setPanelTitle(panelId, `Chat — ${itemName}`)
  }, [panelId, itemName, setPanelTitle])

  // Saves in the sibling ItemPanel inject a system message server-side —
  // bump the trigger so the chat re-fetches history.
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  useEffect(
    () => subscribeChatRefresh(entityId, () => setRefreshTrigger((n) => n + 1)),
    [entityId]
  )

  const thumbnail = item?.image_url ? proxyImageUrl(item.image_url) : undefined

  return (
    <div className={styles.body}>
      <PerItemChat
        itemId={entityId}
        itemName={itemName}
        {...(thumbnail ? { thumbnailUrl: thumbnail } : {})}
        chatRefreshTrigger={refreshTrigger}
        isFullscreen={false}
        hideHeader
      />
    </div>
  )
}
