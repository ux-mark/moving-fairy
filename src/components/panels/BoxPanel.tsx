'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ConfirmDialog, Spinner } from '@thefairies/design-system/components'

import { BoxCard } from '@/components/boxes/BoxCard'
import type { FlaggedItem, ScanResult } from '@/components/boxes/BoxCard'
import type { DraftKind } from '@/components/boxes/ScanDraftReview'
import { LightAssessmentWarning } from '@/components/inventory/LightAssessmentWarning'
import { PackingToast } from '@/components/boxes/PackingToast'
import { useBoxes } from '@/lib/hooks/useBoxes'
import { useItems } from '@/lib/hooks/useItems'
import { useProfileId } from '@/lib/hooks/useProfileId'
import {
  BiosecurityFlag,
  BoxType,
  Verdict,
  computeBoxLabel,
} from '@/lib/constants'
import { ownerCopy } from '@/lib/copy/owner'
import type { Box, BoxItem, BoxScanDuplicateProposedItem, BoxScanProposedItem, ItemAssessment } from '@/types'

import { usePanels } from './PanelProvider'
import type { PanelContentProps } from './registry'
import styles from './BoxPanel.module.css'

interface ConfirmPayload {
  item_name: string
  verdict: 'SHIP' | 'CARRY'
  flags: string[]
  advice_text: string
  box_id: string | null
  voltage_compatible: boolean
  needs_transformer: boolean
}

interface PendingWarning {
  warningCard: {
    title: string
    message: string
    item_name: string
    box_id: string | null
    actions: string[]
  }
  flagMessages: Array<{ flag: string; label: string; detail: string }>
  confirmPayload: ConfirmPayload
}

interface ToastState {
  message: string
  variant: 'success' | 'error'
}

const isTravellingBox = (box: Box) =>
  box.box_type === BoxType.CARRYON || box.box_type === BoxType.CHECKED_LUGGAGE

/**
 * Box detail panel (spec §3) — hosts BoxCard in controlled-open mode, exactly
 * the surface BoxDetailDrawer provided, but self-sufficient: data comes from
 * the live boxes/items hooks and every mutation is a thin API call followed by
 * a refetch (realtime carries the change to every other surface).
 */
export function BoxPanel({ panelId: id, entityId }: PanelContentProps) {
  const { setPanelTitle } = usePanels()
  const profileId = useProfileId()
  const { rows: boxes, isLoading, refresh: refreshBoxes } = useBoxes()
  const { items: allItems, refresh: refreshItems } = useItems(profileId)
  const box = boxes.find((b) => b.id === entityId)

  const title = box ? `${box.label} · ${box.room_name}` : 'Box'
  useEffect(() => {
    setPanelTitle(id, title)
  }, [id, title, setPanelTitle])

  const [toast, setToast] = useState<ToastState | null>(null)
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(t)
  }, [toast])

  const assessmentMap = useMemo(() => {
    const map: Record<string, ItemAssessment> = {}
    for (const a of allItems) map[a.id] = a
    return map
  }, [allItems])

  // Which box each assessment currently sits in (across all boxes).
  const itemBoxIdMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const b of boxes) {
      for (const it of b.items ?? []) {
        if (it.item_assessment_id) m.set(it.item_assessment_id, b.id)
      }
    }
    return m
  }, [boxes])

  // Candidates for the add-existing combobox: for luggage, every CARRY item
  // not already in this box (moving it in is the point); for freight, every
  // unboxed SHIP/CARRY item. Mirrors BoxList's carryCandidatesFor/unboxedItems.
  const unboxedItems = useMemo(() => {
    if (!box) return []
    if (isTravellingBox(box)) {
      return allItems.filter(
        (a) => a.verdict === Verdict.CARRY && itemBoxIdMap.get(a.id) !== box.id
      )
    }
    return allItems.filter(
      (a) =>
        (a.verdict === Verdict.SHIP || a.verdict === Verdict.CARRY) &&
        !itemBoxIdMap.has(a.id)
    )
  }, [box, allItems, itemBoxIdMap])

  const biosecItemCount = useMemo(() => {
    if (!box) return 0
    let n = 0
    for (const it of box.items ?? []) {
      const flag = it.item_assessment_id
        ? assessmentMap[it.item_assessment_id]?.biosecurity_flag
        : undefined
      if (flag && flag !== BiosecurityFlag.NONE) n += 1
    }
    return n
  }, [box, assessmentMap])

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshBoxes(), refreshItems()])
  }, [refreshBoxes, refreshItems])

  // ── Item add / remove / box edits ────────────────────────────────────────

  const [pendingWarning, setPendingWarning] = useState<PendingWarning | null>(null)

  const handleAddItem = useCallback(
    async (boxId: string, itemName: string) => {
      try {
        // Light assessment first — it saves and boxes the item when clean.
        const assessRes = await fetch('/api/light-assessment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_name: itemName, box_id: boxId }),
        })

        if (!assessRes.ok) {
          // Fall back to a direct add if assessment fails.
          const res = await fetch(`/api/boxes/${boxId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_name: itemName }),
          })
          if (!res.ok) throw new Error('Failed to add item')
          await refreshAll()
          return
        }

        const assessData = await assessRes.json()
        if (assessData.verdict === 'BLOCKED') {
          setToast({
            message: ownerCopy.packing.addErrorToast(itemName),
            variant: 'error',
          })
          return
        }
        if (assessData.needs_confirmation && assessData.warning_card) {
          setPendingWarning({
            warningCard: assessData.warning_card,
            flagMessages: assessData.flag_messages ?? [],
            confirmPayload: assessData.confirm_payload,
          })
          return
        }
        await refreshAll()
      } catch (err) {
        console.error('Failed to add item:', err)
        setToast({ message: ownerCopy.packing.addErrorToast(itemName), variant: 'error' })
      }
    },
    [refreshAll]
  )

  const handleWarningConfirm = useCallback(
    async (payload: ConfirmPayload) => {
      try {
        const res = await fetch('/api/light-assessment/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to confirm assessment')
        await refreshAll()
      } catch (err) {
        console.error('Failed to confirm light assessment:', err)
        setToast({ message: ownerCopy.itinerary.saveError, variant: 'error' })
      } finally {
        setPendingWarning(null)
      }
    },
    [refreshAll]
  )

  const handleAddExistingItem = useCallback(
    async (boxId: string, assessmentId: string) => {
      const assessment = assessmentMap[assessmentId]
      try {
        const res = await fetch(`/api/boxes/${boxId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_assessment_id: assessmentId }),
        })
        if (!res.ok) throw new Error('Failed to add item to box')
        await refreshBoxes()
        setToast({
          message: ownerCopy.packing.addedToast(
            assessment?.item_name ?? 'item',
            box?.label ?? 'box'
          ),
          variant: 'success',
        })
      } catch (err) {
        console.error('Failed to add item to box:', err)
        setToast({
          message: ownerCopy.packing.addErrorToast(assessment?.item_name ?? 'item'),
          variant: 'error',
        })
      }
    },
    [assessmentMap, box?.label, refreshBoxes]
  )

  const handleRemoveItem = useCallback(
    async (boxId: string, boxItemId: string) => {
      try {
        const res = await fetch(`/api/boxes/${boxId}/items/${boxItemId}`, {
          method: 'DELETE',
        })
        if (!res.ok) throw new Error('Failed to remove item')
        await refreshBoxes()
      } catch (err) {
        console.error('Failed to remove item:', err)
        setToast({ message: ownerCopy.itinerary.saveError, variant: 'error' })
      }
    },
    [refreshBoxes]
  )

  const handleMarkPacked = useCallback(
    async (boxId: string) => {
      try {
        const res = await fetch(`/api/boxes/${boxId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'packed' }),
        })
        if (!res.ok) throw new Error('Failed to update box status')
        await refreshBoxes()
      } catch (err) {
        console.error('Failed to mark box as packed:', err)
        setToast({ message: ownerCopy.itinerary.saveError, variant: 'error' })
      }
    },
    [refreshBoxes]
  )

  const handleUpdateBox = useCallback(
    async (
      boxId: string,
      updates: { label?: string; room_name?: string; room_code?: string; size?: string; is_biosecurity?: boolean }
    ) => {
      try {
        const res = await fetch(`/api/boxes/${boxId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(data?.error ?? 'Failed to update box')
        }
        await refreshBoxes()
      } catch (err) {
        console.error('Failed to update box:', err)
        const message = err instanceof Error ? err.message : ownerCopy.itinerary.saveError
        setToast({ message, variant: 'error' })
      }
    },
    [refreshBoxes]
  )

  const handleMarkBiosecurity = useCallback(
    (boxId: string) => {
      void handleUpdateBox(boxId, { is_biosecurity: true })
    },
    [handleUpdateBox]
  )

  // Renumber — if the target number is taken, confirm the swap first
  // (mirrors BoxList; the server swaps atomically).
  const [pendingRenumber, setPendingRenumber] = useState<
    { box: Box; newNumber: number; swapWith: Box } | null
  >(null)

  const applyRenumber = useCallback(
    async (boxId: string, newNumber: number) => {
      try {
        const res = await fetch(`/api/boxes/${boxId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ box_number: newNumber }),
        })
        if (!res.ok) throw new Error('Failed to renumber box')
        await refreshBoxes()
      } catch (err) {
        console.error('Failed to renumber box:', err)
        setToast({ message: ownerCopy.itinerary.saveError, variant: 'error' })
      }
    },
    [refreshBoxes]
  )

  const handleRenumber = useCallback(
    (boxId: string, newNumber: number) => {
      const target = boxes.find((b) => b.id === boxId)
      if (!target || target.box_number === newNumber) return
      const swapWith = boxes.find((b) => b.id !== boxId && b.box_number === newNumber)
      if (swapWith) {
        setPendingRenumber({ box: target, newNumber, swapWith })
      } else {
        void applyRenumber(boxId, newNumber)
      }
    },
    [boxes, applyRenumber]
  )

  // ── Sticker scan (port of BoxManagement's flow, scoped to this box) ──────

  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [flaggedItems, setFlaggedItems] = useState<FlaggedItem[]>([])
  const [resolvingItemIds, setResolvingItemIds] = useState<Set<string>>(new Set())
  const [isConfirmingDrafts, setIsConfirmingDrafts] = useState(false)
  // Possible-duplicate scan proposals awaiting an add/skip decision, plus the
  // scan they belong to (the resolve endpoint is scoped to a scan id).
  const [duplicates, setDuplicates] = useState<BoxScanDuplicateProposedItem[]>([])
  const [duplicateScanId, setDuplicateScanId] = useState<string | null>(null)

  const pollScan = useCallback(
    async (boxId: string, scanId: string) => {
      const zero = { totalFound: 0, matchedCount: 0, newCount: 0, flaggedCount: 0, duplicateCount: 0, illegibleCount: 0 }
      const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
      const deadline = Date.now() + 90_000

      while (Date.now() < deadline) {
        await sleep(1500)
        let data: {
          status?: string
          total_found?: number
          matched_count?: number
          new_count?: number
          flagged_count?: number
          duplicate_count?: number
          illegible_count?: number
          flagged_items?: Array<{ item_assessment_id: string; verdict: string; item_name: string }>
          proposed_items?: BoxScanProposedItem[]
        }
        try {
          const res = await fetch(`/api/boxes/${boxId}/scan/${scanId}`)
          if (!res.ok) continue
          data = await res.json()
        } catch {
          continue
        }

        if (data.status === 'complete') {
          setFlaggedItems(
            (data.flagged_items ?? []).map((f) => ({
              item_assessment_id: f.item_assessment_id,
              verdict: f.verdict as FlaggedItem['verdict'],
              item_name: f.item_name,
            }))
          )
          setDuplicates(
            (data.proposed_items ?? []).filter(
              (p): p is BoxScanDuplicateProposedItem => p.kind === 'duplicate'
            )
          )
          setDuplicateScanId(scanId)
          setScanResult({
            status: 'complete',
            totalFound: data.total_found ?? 0,
            matchedCount: data.matched_count ?? 0,
            newCount: data.new_count ?? 0,
            flaggedCount: data.flagged_count ?? 0,
            duplicateCount: data.duplicate_count ?? 0,
            illegibleCount: data.illegible_count ?? 0,
          })
          await refreshAll()
          return
        }

        if (data.status === 'failed') {
          setScanResult({
            status: 'error',
            ...zero,
            errorMessage: "Aisling couldn't read this label. Try another photo in good light.",
          })
          return
        }
      }

      setScanResult({
        status: 'error',
        ...zero,
        errorMessage: 'This is taking longer than expected — refresh to see the result.',
      })
    },
    [refreshAll]
  )

  const handleScanSticker = useCallback(
    async (boxId: string, file: File) => {
      const zero = { totalFound: 0, matchedCount: 0, newCount: 0, flaggedCount: 0, duplicateCount: 0, illegibleCount: 0 }
      setIsScanning(true)
      setScanResult({ status: 'uploading', ...zero })
      try {
        const formData = new FormData()
        formData.append('file', file)
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
        if (!uploadRes.ok) throw new Error('Upload failed')
        const { url } = await uploadRes.json()

        await fetch(`/api/boxes/${boxId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manifest_image_url: url }),
        })

        setScanResult({ status: 'processing', ...zero })

        const scanRes = await fetch(`/api/boxes/${boxId}/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manifest_image_url: url }),
        })
        if (!scanRes.ok) throw new Error('Scan failed to start')
        const { scan_id: scanId } = (await scanRes.json()) as { scan_id: string }
        await pollScan(boxId, scanId)
      } catch (err) {
        console.error('[scan sticker] Failed:', err)
        setScanResult({
          status: 'error',
          ...zero,
          errorMessage: 'Could not upload the photo. Check your connection and try again.',
        })
      } finally {
        setIsScanning(false)
      }
    },
    [pollScan]
  )

  const handleConfirmDrafts = useCallback(
    async (boxId: string) => {
      const draftCount = (box?.items ?? []).filter((i) => i.is_draft).length
      if (draftCount === 0) return
      setIsConfirmingDrafts(true)
      try {
        const res = await fetch(`/api/boxes/${boxId}/confirm-drafts`, { method: 'POST' })
        if (!res.ok) throw new Error('Failed to confirm drafts')
        setScanResult(null)
        await refreshBoxes()
        setToast({
          message: ownerCopy.packing.draftsConfirmedToast(draftCount, box?.label ?? 'box'),
          variant: 'success',
        })
      } catch (err) {
        console.error('[confirm drafts] failed:', err)
        await refreshBoxes()
        setToast({ message: ownerCopy.packing.draftConfirmError, variant: 'error' })
      } finally {
        setIsConfirmingDrafts(false)
      }
    },
    [box?.items, box?.label, refreshBoxes]
  )

  const handleRemoveDraft = useCallback(
    async (boxId: string, item: BoxItem, kind: DraftKind) => {
      const assessmentId = item.item_assessment_id
      if (assessmentId) setResolvingItemIds((prev) => new Set([...prev, assessmentId]))
      try {
        if (kind === 'new' && assessmentId) {
          const res = await fetch(`/api/items/${assessmentId}`, { method: 'DELETE' })
          if (!res.ok) throw new Error('Failed to delete item')
        } else {
          const res = await fetch(`/api/boxes/${boxId}/items/${item.id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error('Failed to remove item from box')
        }
        await refreshAll()
      } catch (err) {
        console.error('[remove draft] failed:', err)
        setToast({ message: ownerCopy.itinerary.saveError, variant: 'error' })
      } finally {
        if (assessmentId) {
          setResolvingItemIds((prev) => {
            const next = new Set(prev)
            next.delete(assessmentId)
            return next
          })
        }
      }
    },
    [refreshAll]
  )

  // Resolve one possible-duplicate proposal: optimistic row removal, restore
  // (at its index) on failure.
  const resolveDuplicate = useCallback(
    async (
      boxId: string,
      proposal: BoxScanDuplicateProposedItem,
      action: 'add_duplicate' | 'skip_duplicate'
    ) => {
      if (!duplicateScanId) return
      const itemId = proposal.item_assessment_id
      const index = duplicates.findIndex((d) => d.item_assessment_id === itemId)

      setResolvingItemIds((prev) => new Set([...prev, itemId]))
      setDuplicates((prev) => prev.filter((d) => d.item_assessment_id !== itemId))

      try {
        const res = await fetch(`/api/boxes/${boxId}/scan/${duplicateScanId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, item_assessment_id: itemId }),
        })
        if (!res.ok) throw new Error(`Failed to ${action}`)
        setScanResult((prev) =>
          prev ? { ...prev, duplicateCount: Math.max(0, prev.duplicateCount - 1) } : prev
        )
        if (action === 'add_duplicate') {
          await refreshAll()
          setToast({
            message: ownerCopy.packing.duplicateAddedToast(
              proposal.item_name,
              box?.label ?? 'box'
            ),
            variant: 'success',
          })
        }
      } catch (err) {
        console.error(`[${action}] failed:`, err)
        setDuplicates((prev) => {
          const list = [...prev]
          list.splice(index < 0 ? list.length : index, 0, proposal)
          return list
        })
        setToast({
          message:
            action === 'add_duplicate'
              ? ownerCopy.packing.duplicateAddError(proposal.item_name)
              : ownerCopy.packing.duplicateSkipError,
          variant: 'error',
        })
      } finally {
        setResolvingItemIds((prev) => {
          const next = new Set(prev)
          next.delete(itemId)
          return next
        })
      }
    },
    [box?.label, duplicateScanId, duplicates, refreshAll]
  )

  const handleAddDuplicate = useCallback(
    (boxId: string, proposal: BoxScanDuplicateProposedItem) =>
      void resolveDuplicate(boxId, proposal, 'add_duplicate'),
    [resolveDuplicate]
  )

  const handleSkipDuplicate = useCallback(
    (boxId: string, proposal: BoxScanDuplicateProposedItem) =>
      void resolveDuplicate(boxId, proposal, 'skip_duplicate'),
    [resolveDuplicate]
  )

  const handleShipAnyway = useCallback(
    async (itemId: string, boxId: string) => {
      setResolvingItemIds((prev) => new Set([...prev, itemId]))
      try {
        const verdictRes = await fetch(`/api/items/${itemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verdict: 'SHIP' }),
        })
        if (!verdictRes.ok) throw new Error('Failed to update verdict')
        const addRes = await fetch(`/api/boxes/${boxId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_assessment_id: itemId }),
        })
        if (!addRes.ok) throw new Error('Failed to add item to box')
        setFlaggedItems((prev) => prev.filter((f) => f.item_assessment_id !== itemId))
        setScanResult((prev) =>
          prev ? { ...prev, flaggedCount: Math.max(0, prev.flaggedCount - 1) } : prev
        )
        await refreshAll()
      } catch (err) {
        console.error('[ship anyway] Failed:', err)
        setToast({ message: ownerCopy.itinerary.saveError, variant: 'error' })
      } finally {
        setResolvingItemIds((prev) => {
          const next = new Set(prev)
          next.delete(itemId)
          return next
        })
      }
    },
    [refreshAll]
  )

  const handleRemoveFlaggedItem = useCallback(
    async (itemId: string, boxId: string) => {
      setResolvingItemIds((prev) => new Set([...prev, itemId]))
      try {
        const boxItem = box?.items?.find((i) => i.item_assessment_id === itemId)
        if (boxItem) {
          const res = await fetch(`/api/boxes/${boxId}/items/${boxItem.id}`, {
            method: 'DELETE',
          })
          if (!res.ok) throw new Error('Failed to remove item from box')
          await refreshBoxes()
        }
        setFlaggedItems((prev) => prev.filter((f) => f.item_assessment_id !== itemId))
        setScanResult((prev) =>
          prev ? { ...prev, flaggedCount: Math.max(0, prev.flaggedCount - 1) } : prev
        )
      } catch (err) {
        console.error('[remove flagged item] Failed:', err)
        setToast({ message: ownerCopy.itinerary.saveError, variant: 'error' })
      } finally {
        setResolvingItemIds((prev) => {
          const next = new Set(prev)
          next.delete(itemId)
          return next
        })
      }
    },
    [box?.items, refreshBoxes]
  )

  if (!box) {
    return (
      <div className={styles.body}>
        {isLoading ? (
          <div className={styles.state} aria-busy="true">
            <Spinner size="md" />
            <p className={styles.stateText}>Loading box…</p>
          </div>
        ) : (
          <div className={styles.state} role="status">
            <p className={styles.stateTitle}>Box not found</p>
            <p className={styles.stateText}>
              This box may have been deleted, or you don&apos;t have access to it.
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={styles.body}>
      {pendingWarning && (
        <LightAssessmentWarning
          warningCard={pendingWarning.warningCard}
          flagMessages={pendingWarning.flagMessages}
          confirmPayload={pendingWarning.confirmPayload}
          onConfirm={handleWarningConfirm}
          onDismiss={() => setPendingWarning(null)}
        />
      )}

      <BoxCard
        box={box}
        items={box.items ?? []}
        assessments={assessmentMap}
        unboxedItems={unboxedItems}
        open={true}
        onOpenChange={() => { /* panel mode: box stays open */ }}
        hideExpandAffordance
        onAddItem={handleAddItem}
        onAddExistingItem={handleAddExistingItem}
        onRemoveItem={handleRemoveItem}
        onMarkPacked={handleMarkPacked}
        onUpdateBox={handleUpdateBox}
        biosecItemCount={biosecItemCount}
        onMarkBiosecurity={handleMarkBiosecurity}
        onRenumber={handleRenumber}
        scanResult={scanResult}
        flaggedItems={flaggedItems}
        onScanSticker={handleScanSticker}
        onShipAnyway={handleShipAnyway}
        onRemoveFlaggedItem={handleRemoveFlaggedItem}
        onConfirmDrafts={handleConfirmDrafts}
        onRemoveDraft={handleRemoveDraft}
        duplicateProposals={duplicates}
        onAddDuplicate={handleAddDuplicate}
        onSkipDuplicate={handleSkipDuplicate}
        isConfirmingDrafts={isConfirmingDrafts}
        isScanning={isScanning}
        resolvingItemIds={resolvingItemIds}
      />

      {pendingRenumber && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setPendingRenumber(null)}
          title="Swap box numbers?"
          description={`${pendingRenumber.box.label} becomes ${computeBoxLabel(
            pendingRenumber.box.box_type,
            pendingRenumber.box.room_name,
            pendingRenumber.newNumber,
            pendingRenumber.box.room_name,
          )}, and ${pendingRenumber.swapWith.label} becomes ${computeBoxLabel(
            pendingRenumber.swapWith.box_type,
            pendingRenumber.swapWith.room_name,
            pendingRenumber.box.box_number,
            pendingRenumber.swapWith.room_name,
          )}.`}
          confirmLabel="Swap"
          cancelLabel="Cancel"
          onConfirm={() => {
            void applyRenumber(pendingRenumber.box.id, pendingRenumber.newNumber)
            setPendingRenumber(null)
          }}
        />
      )}

      {toast && (
        <PackingToast
          message={toast.message}
          variant={toast.variant}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  )
}
