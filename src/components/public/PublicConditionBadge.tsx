import type { ListingCondition } from '@/lib/constants'
import { buyerCopy } from '@/lib/copy/buyer'
import styles from './PublicConditionBadge.module.css'

type Props = { condition: ListingCondition | null | undefined }

/**
 * Condition badge for the public (buyer) surface. US English labels live in
 * `buyerCopy.conditionLabels`. Tone follows sale-fairy:
 *   excellent / like_new → green
 *   good                 → amber
 *   fair                 → grey
 */
export function PublicConditionBadge({ condition }: Props) {
  if (!condition) return null
  const label = buyerCopy.conditionLabels[condition]
  const tone =
    condition === 'excellent' || condition === 'like_new'
      ? 'green'
      : condition === 'good'
        ? 'amber'
        : 'grey'
  return <span className={`${styles.badge} ${styles[tone]}`}>{label}</span>
}
