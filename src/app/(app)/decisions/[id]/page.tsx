'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { RecommendationCardSkeleton } from '@thefairies/design-system/components'
import { AppLayout } from '@/components/layout/AppLayout'
import { ItemDetailView } from '@/components/decisions/ItemDetailView'
import type { ItemAssessment } from '@/types'
import styles from './ItemDetailPage.module.css'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 3000
const TERMINAL_STATUSES = new Set(['completed', 'failed'])

// ---------------------------------------------------------------------------
// Page states
// ---------------------------------------------------------------------------

type PageState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; item: ItemAssessment }

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ItemDetailPage() {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : params.id?.[0] ?? ''
  const [pageState, setPageState] = useState<PageState>({ status: 'loading' })

  // Keep a mutable ref so polling callbacks always see the current state
  // without needing to be in the effect dep array.
  const pageStateRef = useRef<PageState>({ status: 'loading' })
  pageStateRef.current = pageState

  const fetchItem = useCallback(async (signal: AbortSignal | null = null): Promise<ItemAssessment | null> => {
    const res = await fetch(`/api/items/${id}`, { signal })
    if (res.status === 404) {
      setPageState({ status: 'not-found' })
      return null
    }
    if (!res.ok) {
      const data = await res.json() as { error?: string }
      setPageState({
        status: 'error',
        message: data.error ?? `Failed to load item (${res.status})`,
      })
      return null
    }
    const item = await res.json() as ItemAssessment
    setPageState({ status: 'ready', item })
    return item
  }, [id])

  useEffect(() => {
    if (!id) {
      setPageState({ status: 'not-found' })
      return
    }

    const controller = new AbortController()
    let pollTimer: ReturnType<typeof setInterval> | null = null

    async function initialFetch() {
      try {
        const item = await fetchItem(controller.signal)

        // If item is in a non-terminal state, start polling
        if (item && !TERMINAL_STATUSES.has(item.processing_status)) {
          pollTimer = setInterval(async () => {
            // Stop polling if we're no longer in a processing state
            const current = pageStateRef.current
            if (current.status === 'ready' && TERMINAL_STATUSES.has(current.item.processing_status)) {
              if (pollTimer !== null) {
                clearInterval(pollTimer)
                pollTimer = null
              }
              return
            }

            try {
              const polled = await fetchItem(controller.signal)
              if (polled && TERMINAL_STATUSES.has(polled.processing_status)) {
                if (pollTimer !== null) {
                  clearInterval(pollTimer)
                  pollTimer = null
                }
              }
            } catch {
              // Ignore poll errors — will retry on next interval
            }
          }, POLL_INTERVAL_MS)
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        setPageState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Failed to load item',
        })
      }
    }

    void initialFetch()

    return () => {
      controller.abort()
      if (pollTimer !== null) clearInterval(pollTimer)
    }
  }, [id, fetchItem])

  // ---------------------------------------------------------------------------
  // Handlers passed down to ItemDetailView
  // ---------------------------------------------------------------------------

  const handleConfirm = useCallback(async (itemId: string) => {
    try {
      const res = await fetch(`/api/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_confirmed: true }),
      })
      if (!res.ok) return
      const updated = await res.json() as ItemAssessment
      setPageState((prev) =>
        prev.status === 'ready' ? { status: 'ready', item: updated } : prev
      )
    } catch {
      // Non-critical — user can retry
    }
  }, [])

  const handleRetry = useCallback(async (itemId: string) => {
    // Optimistically switch to processing state
    setPageState((prev) =>
      prev.status === 'ready'
        ? { status: 'ready', item: { ...prev.item, processing_status: 'processing' } }
        : prev
    )
    try {
      await fetch(`/api/assess/${itemId}`, { method: 'POST' })
    } catch {
      // Ignore — polling will pick up the real state
    }
  }, [])

  return (
    <AppLayout>
      {pageState.status === 'loading' && (
        <div className={styles.loadingRoot} aria-busy="true" aria-label="Loading item">
          <div className={styles.loadingContent}>
            <div className={styles.backPlaceholder} />
            <RecommendationCardSkeleton />
            <div className={styles.chatPlaceholder} aria-hidden="true" />
          </div>
        </div>
      )}

      {pageState.status === 'not-found' && (
        <div className={styles.stateRoot}>
          <div className={styles.stateContent}>
            <Link href="/decisions" className={styles.backLink}>
              <ArrowLeft size={16} aria-hidden="true" />
              Back to decisions
            </Link>
            <div className={styles.notFoundState}>
              <p className={styles.stateTitle}>Item not found</p>
              <p className={styles.stateText}>
                This item doesn't exist or you don't have access to it.{' '}
                <Link href="/decisions" className={styles.stateLink}>
                  View all your decisions
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      )}

      {pageState.status === 'error' && (
        <div className={styles.stateRoot}>
          <div className={styles.stateContent}>
            <Link href="/decisions" className={styles.backLink}>
              <ArrowLeft size={16} aria-hidden="true" />
              Back to decisions
            </Link>
            <div className={styles.errorState} role="alert">
              <p className={styles.stateTitle}>Something went wrong</p>
              <p className={styles.stateText}>{pageState.message}</p>
              <p className={styles.stateText}>
                <Link href="/decisions" className={styles.stateLink}>
                  Go back to your decisions list
                </Link>{' '}
                and try again.
              </p>
            </div>
          </div>
        </div>
      )}

      {pageState.status === 'ready' && (
        <ItemDetailView
          item={pageState.item}
          onConfirm={handleConfirm}
          onRetry={handleRetry}
        />
      )}
    </AppLayout>
  )
}
