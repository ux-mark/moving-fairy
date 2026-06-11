'use client'

import { memo } from 'react'
import Image from 'next/image'
import { Camera, Check, RotateCcw, Sparkles, AlertCircle } from 'lucide-react'

import { proxyImageUrl } from '@/lib/storage-url'
import { cn } from '@/lib/utils'
import type { ItemAssessment } from '@/types'

import styles from './ItemTile.module.css'

interface ItemTileProps {
  item: ItemAssessment
  onClick: (id: string) => void
  onRetry?: (id: string) => void
  onDelete?: ((id: string) => void) | undefined
  /** When true, the tile shows a brief "just decided" verdict-coloured pulse animation. */
  justDecided?: boolean
}

const VERDICT_LABELS: Record<string, string> = {
  SHIP:    'Ship',
  CARRY:   'Carry',
  SELL:    'Sell',
  DONATE:  'Donate',
  DISCARD: 'Discard',
  REVISIT: 'Decide later',
}

// Verdict accent colors (left edge + dot). Tokens, with safe fallbacks.
const VERDICT_ACCENT: Record<string, string> = {
  SHIP:    'var(--verdict-ship, #16a34a)',
  CARRY:   'var(--verdict-carry, #2563eb)',
  SELL:    'var(--verdict-sell, #d97706)',
  DONATE:  'var(--verdict-donate, #6b7280)',
  DISCARD: 'var(--verdict-discard, #6b7280)',
  REVISIT: 'var(--verdict-decide-later, #3b82f6)',
}

function formatCurrency(amount: number | null | undefined, currency: string | null | undefined): string | null {
  if (amount == null) return null
  const cur = currency ?? 'EUR'
  try {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${cur} ${Math.round(amount)}`
  }
}

/**
 * Compact, scannable tile used in /items and /decisions grid views on desktop.
 *
 * Hero photo, verdict badge overlaid top-right, two-line title, one meta line.
 * Whole tile is the primary click target — opens the detail drawer / route.
 * No inline actions (Confirm / Skip / Change verdict / etc.) — those live in
 * the drawer where there is space to do them properly.
 *
 * Memoised: realtime updates replace only the changed item's row object, so
 * sibling tiles skip re-rendering — callers pass stable (useCallback) handlers.
 */
export const ItemTile = memo(function ItemTile({ item, onClick, onRetry, onDelete, justDecided }: ItemTileProps) {
  const isCompleted = item.processing_status === 'completed'
  const isPending = item.processing_status === 'pending'
  const isProcessing = item.processing_status === 'processing'
  const isFailed = item.processing_status === 'failed'

  const itemName = item.item_name || 'New item'
  const thumbnail = item.image_url ? proxyImageUrl(item.image_url) : undefined
  const verdict = item.verdict ?? null
  const accent = verdict ? VERDICT_ACCENT[verdict] : undefined

  // Cost meta line: prefer ship cost when shipping/carrying, replace cost otherwise.
  const shipCost = formatCurrency(item.estimated_ship_cost, item.currency)
  const replaceCost = formatCurrency(item.estimated_replace_cost, item.replace_currency)
  const showsShip = verdict === 'SHIP' || verdict === 'CARRY'
  const primaryCost = showsShip ? (shipCost ?? replaceCost) : (replaceCost ?? shipCost)

  const handleClick = () => {
    // Failed items: tapping should retry the assessment rather than open a drawer
    // for an item that can't yet be edited. Drawer is still available via onClick
    // if the caller prefers; this matches the existing ItemCard behaviour.
    if (isFailed && onRetry) {
      onRetry(item.id)
      return
    }
    onClick(item.id)
  }

  // Delete trigger is shown for non-completed states (matches ItemCard parity).
  const showDelete = onDelete && !isCompleted

  return (
    <button
      type="button"
      className={cn(
        styles.tile,
        item.user_confirmed && styles.tileConfirmed,
      )}
      onClick={handleClick}
      style={accent ? ({ '--tile-accent': accent } as React.CSSProperties) : undefined}
      data-just-decided={justDecided ? 'true' : undefined}
      aria-label={`${itemName}${verdict ? `, verdict ${VERDICT_LABELS[verdict] ?? verdict}` : ''}`}
    >
      <div className={styles.imageWrap}>
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt=""
            fill
            sizes="(min-width: 1600px) 25vw, (min-width: 1024px) 33vw, 50vw"
            className={styles.image}
            unoptimized
          />
        ) : (
          <div className={styles.imagePlaceholder} aria-hidden="true">
            <Camera size={28} />
          </div>
        )}

        {(isPending || isProcessing) && <span className={styles.shimmer} aria-hidden="true" />}

        {verdict && isCompleted && (
          <span className={styles.verdictBadge}>
            <span
              className={styles.verdictDot}
              style={accent ? ({ '--verdict-dot': accent } as React.CSSProperties) : undefined}
            />
            {VERDICT_LABELS[verdict] ?? verdict}
          </span>
        )}

        {isCompleted && item.user_confirmed && (
          <span className={styles.confirmedCheck} aria-label="Confirmed">
            <Check size={14} aria-hidden="true" />
          </span>
        )}

        {showDelete && (
          <button
            type="button"
            className={styles.deleteTrigger}
            onClick={(e) => {
              e.stopPropagation()
              onDelete?.(item.id)
            }}
            aria-label={`Delete ${itemName}`}
          >
            Delete
          </button>
        )}

        {(isPending || isProcessing) && (
          <span className={styles.statusBanner} role="status">
            <Sparkles size={12} aria-hidden="true" />
            {isPending ? 'Queued for Aisling' : 'Aisling is looking…'}
          </span>
        )}

        {isFailed && (
          <span className={cn(styles.statusBanner, styles.statusBannerError)} role="status">
            <AlertCircle size={12} aria-hidden="true" />
            Tap to retry
            <RotateCcw size={12} aria-hidden="true" />
          </span>
        )}
      </div>

      <div className={styles.body}>
        <h3 className={styles.title}>{itemName}</h3>
        {item.item_description && (
          <p className={styles.description}>{item.item_description}</p>
        )}
        {primaryCost && (
          <div className={styles.meta}>
            <span>{showsShip ? 'Ship' : 'Replace'}</span>
            <span className={styles.metaDot} aria-hidden="true" />
            <span>{primaryCost}</span>
          </div>
        )}
      </div>
    </button>
  )
})
