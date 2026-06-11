/**
 * Tiny pub/sub linking an ItemPanel to its chat sub-panel. After a manual save
 * the server injects a system message into the item's conversation; the chat
 * panel listens here and re-fetches history (the old drawer did this via a
 * chatRefreshTrigger prop — panels are siblings, so props can't carry it).
 */
const listeners = new Map<string, Set<() => void>>()

export function subscribeChatRefresh(itemId: string, fn: () => void): () => void {
  let set = listeners.get(itemId)
  if (!set) {
    set = new Set()
    listeners.set(itemId, set)
  }
  set.add(fn)
  return () => {
    const current = listeners.get(itemId)
    if (!current) return
    current.delete(fn)
    if (current.size === 0) listeners.delete(itemId)
  }
}

export function emitChatRefresh(itemId: string): void {
  const set = listeners.get(itemId)
  if (!set) return
  for (const fn of set) fn()
}
