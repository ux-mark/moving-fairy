'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { RecommendationCardSkeleton } from '@thefairies/design-system/components'
import { AppLayout } from '@/components/layout/AppLayout'
import { ItemDetailView } from '@/components/decisions/ItemDetailView'
import type { ItemAssessment } from '@/types'
import styles from './ItemDetailPage.module.css'

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

  useEffect(() => {
    if (!id) {
      setPageState({ status: 'not-found' })
      return
    }

    let cancelled = false

    async function fetchItem() {
      try {
        const res = await fetch(`/api/items/${id}`)
        if (cancelled) return
        if (res.status === 404) {
          setPageState({ status: 'not-found' })
          return
        }
        if (!res.ok) {
          const data = await res.json() as { error?: string }
          setPageState({
            status: 'error',
            message: data.error ?? `Failed to load item (${res.status})`,
          })
          return
        }
        const item = await res.json() as ItemAssessment
        if (!cancelled) {
          setPageState({ status: 'ready', item })
        }
      } catch (err) {
        if (!cancelled) {
          setPageState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Failed to load item',
          })
        }
      }
    }

    fetchItem()
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <AppLayout>
      {pageState.status === 'loading' && (
        <div className={styles.loadingRoot} aria-busy="true" aria-label="Loading item">
          <div className={styles.loadingContent}>
            <div className={styles.backPlaceholder} />
            <RecommendationCardSkeleton />
            <RecommendationCardSkeleton />
          </div>
        </div>
      )}

      {pageState.status === 'not-found' && (
        <div className={styles.stateRoot} role="main">
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
        <div className={styles.stateRoot} role="main">
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
        <ItemDetailView item={pageState.item} />
      )}
    </AppLayout>
  )
}
