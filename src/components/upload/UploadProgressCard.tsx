'use client'

import { Check, ChevronDown, Upload, X } from 'lucide-react'
import { Button } from '@thefairies/design-system/components'

import { cn } from '@/lib/utils'

import { useUploadQueue } from './UploadProvider'
import styles from './UploadProgressCard.module.css'

function photosLabel(n: number): string {
  return n === 1 ? '1 photo' : `${n} photos`
}

interface UploadProgressCardProps {
  /** Positioning is owned by the host slot (AppLayout dock). */
  className?: string | undefined
}

/**
 * Docked, non-blocking upload progress (spec §5). Renders nothing while
 * the queue is idle. Active: determinate progress + failure count;
 * collapsible to a compact chip. Settled: success confirmation
 * (auto-dismissing) or failure summary with a retry action.
 */
export function UploadProgressCard({ className }: UploadProgressCardProps) {
  const { snapshot, retryFailed, dismiss, notice, collapsed, setCollapsed } = useUploadQueue()
  const { phase, total, finished, doneCount, failedCount } = snapshot

  if (phase === 'idle') return null

  if (collapsed) {
    return (
      <button
        type="button"
        className={cn(styles.chip, className)}
        onClick={() => setCollapsed(false)}
        aria-label={`Show upload progress: ${finished} of ${total} finished`}
      >
        <Upload size={14} aria-hidden="true" className={styles.chipIcon} />
        <span>
          {finished} of {total}
        </span>
        {failedCount > 0 && <span className={styles.chipFailed}>{failedCount} failed</span>}
      </button>
    )
  }

  const isSuccess = phase === 'settled' && failedCount === 0

  return (
    <section className={cn(styles.card, className)} aria-label="Photo uploads">
      <div className={styles.header}>
        <p className={styles.title} role="status" aria-live="polite">
          {phase === 'active' && `Uploading ${finished} of ${total}…`}
          {phase === 'settled' && isSuccess && (
            <>
              <Check size={16} aria-hidden="true" className={styles.successIcon} />
              {photosLabel(doneCount)} added
            </>
          )}
          {phase === 'settled' && !isSuccess && `${photosLabel(doneCount)} added, ${failedCount} failed`}
        </p>
        {phase === 'active' ? (
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setCollapsed(true)}
            aria-label="Collapse upload progress"
          >
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            className={styles.iconBtn}
            onClick={dismiss}
            aria-label="Dismiss upload status"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {phase === 'active' && (
        <div
          className={styles.barTrack}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={finished}
          aria-label="Upload progress"
        >
          <div
            className={styles.barFill}
            style={{ width: `${total > 0 ? (finished / total) * 100 : 0}%` }}
          />
        </div>
      )}

      {notice && <p className={styles.notice}>{notice}</p>}

      {failedCount > 0 && (
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={retryFailed}>
            Retry failed
          </Button>
        </div>
      )}
    </section>
  )
}
