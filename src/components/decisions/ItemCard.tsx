'use client'

import { RecommendationCard } from '@thefairies/design-system/components'
import type { ItemAssessment } from '@/types'

interface ItemCardProps {
  item: ItemAssessment
  onConfirm: (id: string) => void
  onRetry: (id: string) => void
  onClick: (id: string) => void
}

// Verdict colours matching the CostSummary palette
const VERDICT_COLORS: Record<string, { bg: string; fg: string }> = {
  SHIP:    { bg: 'var(--verdict-ship-bg, #d1fae5)',           fg: 'var(--verdict-ship-fg, #065f46)' },
  CARRY:   { bg: 'var(--verdict-carry-bg, #d1fae5)',          fg: 'var(--verdict-carry-fg, #065f46)' },
  SELL:    { bg: 'var(--verdict-sell-bg, #fef3c7)',           fg: 'var(--verdict-sell-fg, #92400e)' },
  DONATE:  { bg: 'var(--verdict-donate-bg, #f3f4f6)',         fg: 'var(--verdict-donate-fg, #374151)' },
  DISCARD: { bg: 'var(--verdict-discard-bg, #f3f4f6)',        fg: 'var(--verdict-discard-fg, #374151)' },
  REVISIT: { bg: 'var(--verdict-decide-later-bg, #dbeafe)',   fg: 'var(--verdict-decide-later-fg, #1e40af)' },
}

const VERDICT_LABELS: Record<string, string> = {
  SHIP:    'Ship',
  CARRY:   'Carry',
  SELL:    'Sell',
  DONATE:  'Donate',
  DISCARD: 'Discard',
  REVISIT: 'Decide later',
}

function formatCost(amount: number, currency: string | null): string {
  const cur = currency ?? 'EUR'
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: cur,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function ItemCard({ item, onConfirm, onRetry, onClick }: ItemCardProps) {
  const verdictColors = item.verdict ? VERDICT_COLORS[item.verdict] : undefined
  const verdictLabel = item.verdict ? VERDICT_LABELS[item.verdict] : undefined

  const badge = verdictColors && verdictLabel
    ? { label: verdictLabel, color: verdictColors.bg }
    : undefined

  const metadata: { label: string; value: string }[] = []
  if (item.estimated_ship_cost != null) {
    metadata.push({ label: 'Ship cost', value: formatCost(item.estimated_ship_cost, item.currency) })
  }
  if (item.estimated_replace_cost != null) {
    metadata.push({ label: 'Replace cost', value: formatCost(item.estimated_replace_cost, item.replace_currency) })
  }

  const thumbnail = item.image_url
    ? `/api/img?url=${encodeURIComponent(item.image_url)}`
    : undefined

  // Determine the recommendation status based on user_confirmed
  const status = item.user_confirmed ? 'confirmed' : 'idle'

  return (
    <RecommendationCard
      title={item.item_name || 'New item'}
      rationale={item.advice_text ?? ''}
      {...(badge !== undefined ? { badge } : {})}
      {...(item.confidence != null ? { confidence: item.confidence } : {})}
      {...(metadata && metadata.length > 0 ? { metadata } : {})}
      {...(verdictColors?.bg !== undefined ? { accentColor: verdictColors.bg } : {})}
      status={status}
      {...(item.processing_status !== 'completed' ? { processingStatus: item.processing_status } : {})}
      {...(thumbnail !== undefined ? { thumbnail } : {})}
      onConfirm={() => onConfirm(item.id)}
      onSkip={() => onClick(item.id)}
      {...(item.processing_status === 'failed' ? { onRetry: () => onRetry(item.id) } : {})}
      confirmLabel="Confirm"
      skipLabel="Details"
      processingErrorMessage="Aisling couldn't assess this item. Tap to retry."
      ariaLabel={`Assessment for ${item.item_name || 'new item'}`}
    />
  )
}
