'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

import {
  MAX_BATCH_SIZE,
  UploadQueue,
  type UploadQueueSnapshot,
} from './uploadQueue'

/** Success card lingers briefly, then clears itself. */
const SUCCESS_AUTO_DISMISS_MS = 5000

interface UploadQueueContextValue {
  snapshot: UploadQueueSnapshot
  /** Enqueues files (capped at 50/batch) and returns control immediately. */
  enqueue: (files: File[]) => void
  retryFailed: () => void
  dismiss: () => void
  /** Over-the-cap friendly message, shown in the progress card. */
  notice: string | null
  /** Progress card collapsed to a compact chip (shared across render slots). */
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}

const UploadQueueContext = createContext<UploadQueueContextValue | null>(null)

export function useUploadQueue(): UploadQueueContextValue {
  const ctx = useContext(UploadQueueContext)
  if (!ctx) throw new Error('useUploadQueue must be used inside UploadProvider')
  return ctx
}

async function uploadFileToApi(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? 'Upload failed')
  }
  const data = (await res.json()) as { url?: string }
  if (!data.url) throw new Error('Upload failed')
  return data.url
}

/** Mirrors useItems.addItemByPhoto: create the item, then kick off assessment. */
async function createItemFromUpload(imageUrl: string): Promise<void> {
  const res = await fetch('/api/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, source: 'photo_upload' }),
  })
  if (!res.ok) throw new Error(`Failed to create item (${res.status})`)
  const data = (await res.json()) as { item?: { id?: string }; id?: string }
  const id = data.item?.id ?? data.id
  // Fire-and-forget — Realtime delivers the assessment when it lands.
  if (id) fetch(`/api/assess/${id}`, { method: 'POST' }).catch(console.error)
}

/**
 * Background upload queue (spec §5), mounted above routes in the (app)
 * layout so uploads continue across in-app navigation. Item creation runs
 * per-file on completion, so it also works while away from /decisions —
 * the decisions list picks the new rows up via Realtime, with skeletons
 * driven by `snapshot.pendingCount`.
 */
export function UploadProvider({ children }: { children: ReactNode }) {
  const queueRef = useRef<UploadQueue | null>(null)
  queueRef.current ??= new UploadQueue({
    uploadFile: uploadFileToApi,
    createItem: createItemFromUpload,
  })
  const queue = queueRef.current

  const snapshot = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot)
  const [notice, setNotice] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  const enqueue = useCallback(
    (files: File[]) => {
      const { rejected } = queue.enqueue(files)
      setNotice(
        rejected > 0
          ? `Up to ${MAX_BATCH_SIZE} photos upload at a time — the first ${MAX_BATCH_SIZE} are on their way. Add the other ${rejected} once this batch finishes.`
          : null
      )
      setCollapsed(false)
    },
    [queue]
  )

  const retryFailed = useCallback(() => queue.retryFailed(), [queue])
  const dismiss = useCallback(() => {
    queue.dismiss()
    setNotice(null)
    setCollapsed(false)
  }, [queue])

  // Warn before the page unloads while uploads are still running.
  useEffect(() => {
    if (snapshot.phase !== 'active') return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [snapshot.phase])

  // Fully successful batches confirm, then auto-dismiss. Failures stay
  // until the user retries or dismisses.
  useEffect(() => {
    if (snapshot.phase !== 'settled' || snapshot.failedCount > 0) return
    const timer = setTimeout(dismiss, SUCCESS_AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [snapshot.phase, snapshot.failedCount, dismiss])

  return (
    <UploadQueueContext.Provider
      value={{ snapshot, enqueue, retryFailed, dismiss, notice, collapsed, setCollapsed }}
    >
      {children}
    </UploadQueueContext.Provider>
  )
}
