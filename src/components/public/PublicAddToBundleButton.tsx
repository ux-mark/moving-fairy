'use client'

import { Check, Plus } from 'lucide-react'
import { buyerCopy } from '@/lib/copy/buyer'
import { cn } from '@/lib/utils'
import { usePublicBundle } from './usePublicBundle'
import styles from './PublicAddToBundleButton.module.css'

type Props = {
  listingId: string
  /** Disable when the listing is sold; the button still renders for layout consistency. */
  disabled?: boolean
}

export function PublicAddToBundleButton({ listingId, disabled }: Props) {
  const { has, toggle } = usePublicBundle()
  const selected = has(listingId)

  return (
    <button
      type="button"
      className={cn(styles.btn, selected ? styles.removeBtn : styles.addBtn)}
      onClick={() => toggle(listingId)}
      disabled={disabled}
      aria-pressed={selected}
    >
      {selected ? (
        <>
          <Check size={16} strokeWidth={2.5} aria-hidden />
          {buyerCopy.removeFromBundle}
        </>
      ) : (
        <>
          <Plus size={16} strokeWidth={2.5} aria-hidden />
          {buyerCopy.addToBundle}
        </>
      )}
    </button>
  )
}
