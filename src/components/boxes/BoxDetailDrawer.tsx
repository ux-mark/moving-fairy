'use client'

import { Drawer } from '@/components/layout/Drawer'
import { BoxCard } from '@/components/boxes/BoxCard'
import type { FlaggedItem, ScanResult } from '@/components/boxes/BoxCard'
import type { Box, BoxItem, ItemAssessment } from '@/types'

import styles from './BoxDetailDrawer.module.css'

interface BoxDetailDrawerProps {
  box: Box
  items: BoxItem[]
  assessments?: Record<string, ItemAssessment>
  unboxedItems?: ItemAssessment[]
  onClose: () => void
  onAddItem?: (boxId: string, itemName: string) => void
  onAddExistingItem?: (boxId: string, assessmentId: string) => void
  onRemoveItem?: (boxId: string, boxItemId: string) => void
  onMarkPacked?: (boxId: string) => void
  onUpdateBox?: (boxId: string, updates: { label?: string; room_name?: string; size?: string; is_biosecurity?: boolean }) => void
  /** Count of biosecurity-flagged items in this box (drives the auto badge). */
  biosecItemCount?: number
  /** Manually mark this box as biosecurity (override). */
  onMarkBiosecurity?: (boxId: string) => void
  /** Renumber this box (swap-confirm handled upstream). */
  onRenumber?: (boxId: string, newNumber: number) => void
  scanResult?: ScanResult | null
  flaggedItems?: FlaggedItem[]
  onScanSticker?: (boxId: string, file: File) => void
  onShipAnyway?: (itemId: string, boxId: string) => void
  onRemoveFlaggedItem?: (itemId: string, boxId: string) => void
  isScanning?: boolean
  resolvingItemIds?: Set<string>
}

/**
 * Drawer view of a single box's editor surface. Reuses BoxCard with the
 * controlled-open prop so the same component renders inline (in the list)
 * and in-place (here). The drawer is the only chrome the user sees; the
 * card's own border/shadow are kept so the verdict-coloured left edge
 * still anchors the user visually.
 */
export function BoxDetailDrawer({
  box,
  items,
  assessments,
  unboxedItems,
  onClose,
  ...handlers
}: BoxDetailDrawerProps) {
  return (
    <Drawer
      eyebrow="Box detail"
      title={`${box.label} · ${box.room_name}`}
      onClose={onClose}
      size="lg"
      ariaLabel={`Details for ${box.label} ${box.room_name}`}
    >
      <div className={styles.body}>
        <BoxCard
          box={box}
          items={items}
          assessments={assessments}
          unboxedItems={unboxedItems}
          open={true}
          onOpenChange={() => { /* drawer mode: box stays open */ }}
          hideExpandAffordance
          {...handlers}
        />
      </div>
    </Drawer>
  )
}
