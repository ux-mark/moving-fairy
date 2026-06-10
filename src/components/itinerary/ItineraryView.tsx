'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plane,
  Copy,
  Download,
  FileText,
  ShieldAlert,
  Check,
  ChevronDown,
  ExternalLink,
} from 'lucide-react'
import { Button, ConfirmDialog, EmptyState } from '@thefairies/design-system/components'

import { cn } from '@/lib/utils'
import { ownerCopy, BIOSEC_FLAG_LABELS } from '@/lib/copy/owner'
import { useIsDesktop } from '@/lib/hooks/useIsDesktop'
import { useLiveTableEvents, useRevalidateOnFocus } from '@/lib/hooks/useLiveTable'
import { EditablePill, type EditablePillOption } from '@/components/shared/EditablePill'
import { CurrencySelect } from '@/components/shared/CurrencySelect'
import { BoxSelect, type BoxSelectOption } from '@/components/boxes/BoxSelect'
import { BoxPill } from '@/components/boxes/BoxPill'
import { BiosecurityFlag, Verdict } from '@/lib/constants'
import type { Manifest, ManifestBox } from '@/mcp/shipments'
import type { ItemAssessment, Shipment } from '@/types/database'

import styles from './ItineraryView.module.css'

interface Props {
  shipments: Shipment[]
  activeShipmentId: string | null
  manifest: Manifest | null
}

const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'AUD', 'CAD'] as const

// Verdict pill options seeded with the --verdict-* colour pairs (matching
// VerdictPicker). The itinerary normally shows SHIP/CARRY, but the full set is
// offered because changing away is a legitimate (manifest-removing) edit.
const VERDICT_PILL_OPTIONS: EditablePillOption[] = [
  { value: 'SHIP', label: 'Ship', color: 'var(--verdict-ship-bg)', textColor: 'var(--verdict-ship-fg)' },
  { value: 'CARRY', label: 'Carry', color: 'var(--verdict-carry-bg)', textColor: 'var(--verdict-carry-fg)' },
  { value: 'SELL', label: 'Sell', color: 'var(--verdict-sell-bg)', textColor: 'var(--verdict-sell-fg)' },
  { value: 'DONATE', label: 'Donate', color: 'var(--verdict-donate-bg)', textColor: 'var(--verdict-donate-fg)' },
  { value: 'DISCARD', label: 'Discard', color: 'var(--verdict-discard-bg)', textColor: 'var(--verdict-discard-fg)' },
  { value: 'REVISIT', label: 'Decide later', color: 'var(--verdict-decide-later-bg)', textColor: 'var(--verdict-decide-later-fg)' },
]

// Biosecurity flag pill options. `none` is neutral; the rest escalate through
// the warning palette. Text always carries the meaning (never colour-only).
const BIOSEC_PILL_OPTIONS: EditablePillOption[] = [
  { value: 'none', label: BIOSEC_FLAG_LABELS.none ?? 'None', color: 'var(--color-bg-subtle, #f3f4f6)', textColor: 'var(--color-text-primary, #111827)' },
  { value: 'declare', label: BIOSEC_FLAG_LABELS.declare ?? 'Declare', color: 'var(--color-warning-light, #fef3c7)', textColor: 'var(--color-warning-dark, #92400e)' },
  { value: 'high_risk', label: BIOSEC_FLAG_LABELS.high_risk ?? 'High risk', color: 'var(--color-warning, #f59e0b)', textColor: '#3d2c00' },
  { value: 'prohibited', label: BIOSEC_FLAG_LABELS.prohibited ?? 'Prohibited', color: 'var(--color-danger, #b91c1c)', textColor: '#fff' },
]

const SHIPPABLE_VERDICTS = new Set<string>([Verdict.SHIP, Verdict.CARRY])

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${Math.round(amount)}`
  }
}

/** A pending confirm for a verdict downgrade (SHIP/CARRY → other). */
interface DowngradeConfirm {
  itemId: string
  boxId: string
  boxLabel: string
  itemName: string
  nextVerdict: string
  nextVerdictLabel: string
}

export function ItineraryView({ shipments, activeShipmentId, manifest }: Props) {
  const router = useRouter()
  const isDesktop = useIsDesktop()
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareToast, setShareToast] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [openBoxIds, setOpenBoxIds] = useState<Set<string>>(new Set())

  // Lift the manifest into local state so inline edits recompute totals + the
  // biosec rail without a router.refresh() flicker. Re-seed when the prop
  // identity changes (leg switch, server refresh on navigation).
  const [manifestState, setManifestState] = useState<Manifest | null>(manifest)
  useEffect(() => {
    setManifestState(manifest)
  }, [manifest])

  // Live manifest: box / box_item / item_assessment changes (this device or
  // another) trigger a debounced refetch so the snapshot never goes stale.
  const refreshManifest = useCallback(async () => {
    if (!activeShipmentId) return
    try {
      const res = await fetch(`/api/shipments/${activeShipmentId}?manifest=1`)
      if (!res.ok) return
      setManifestState((await res.json()) as Manifest)
    } catch {
      // Keep the current manifest — the next event or focus retries.
    }
  }, [activeShipmentId])

  const manifestRefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleManifestRefresh = useCallback(() => {
    if (manifestRefetchTimerRef.current) clearTimeout(manifestRefetchTimerRef.current)
    manifestRefetchTimerRef.current = setTimeout(() => {
      manifestRefetchTimerRef.current = null
      void refreshManifest()
    }, 600)
  }, [refreshManifest])
  useEffect(() => {
    return () => {
      if (manifestRefetchTimerRef.current) clearTimeout(manifestRefetchTimerRef.current)
    }
  }, [])

  useLiveTableEvents('box', undefined, scheduleManifestRefresh)
  useLiveTableEvents('box_item', undefined, scheduleManifestRefresh)
  useLiveTableEvents('item_assessment', undefined, scheduleManifestRefresh)
  useRevalidateOnFocus(() => void refreshManifest())

  // Per-control busy + error state, keyed `${boxItemId}:${field}`.
  const [busyFields, setBusyFields] = useState<Set<string>>(new Set())
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  // Items whose value field just saved (show a brief check tick).
  const [savedTicks, setSavedTicks] = useState<Set<string>>(new Set())
  // Pending verdict-downgrade confirm.
  const [downgrade, setDowngrade] = useState<DowngradeConfirm | null>(null)
  const downgradeTriggerRef = useRef<HTMLElement | null>(null)

  const setBusy = useCallback((key: string, on: boolean) => {
    setBusyFields((prev) => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  const setError = useCallback((key: string, msg: string | null) => {
    setFieldErrors((prev) => {
      const next = { ...prev }
      if (msg) next[key] = msg
      else delete next[key]
      return next
    })
  }, [])

  const totalItemCount = useMemo(() => {
    if (!manifestState) return 0
    return manifestState.boxes.reduce((sum, b) => sum + b.items.length, 0)
  }, [manifestState])

  const biosecItems = useMemo(() => {
    if (!manifestState) return []
    const all: Array<{
      boxLabel: string
      boxName: string
      itemName: string
      itemId: string
      flag: string
      category: string | null
      note: string | null
      confirmed: boolean
    }> = []
    for (const b of manifestState.boxes) {
      for (const { item_assessment } of b.items) {
        if (!item_assessment) continue
        const flag = item_assessment.biosecurity_flag
        if (!flag || flag === BiosecurityFlag.NONE) continue
        all.push({
          boxLabel: b.box.label,
          boxName: b.box.room_name,
          itemName: item_assessment.item_name,
          itemId: item_assessment.id,
          flag,
          category: item_assessment.biosecurity_category ?? null,
          note: item_assessment.biosecurity_note ?? null,
          confirmed: item_assessment.user_confirmed_biosecurity,
        })
      }
    }
    return all
  }, [manifestState])

  const biosecByCategory = useMemo(() => {
    const map = new Map<string, typeof biosecItems>()
    for (const row of biosecItems) {
      const key = row.category ?? 'other'
      if (!map.has(key)) map.set(key, [])
      map.get(key)?.push(row)
    }
    return map
  }, [biosecItems])

  // Live totals recomputed from local manifest state so inline value/biosec
  // edits flow into the header tiles + per-box subtotals without a refresh.
  const liveTotals = useMemo(() => {
    const base = manifestState?.totals
    const currency = base?.currency ?? 'EUR'
    let declared_value = 0
    let cbm = 0
    const biosec = { declare: 0, high_risk: 0, prohibited: 0 }
    const perBoxDeclared: Record<string, number> = {}
    for (const b of manifestState?.boxes ?? []) {
      let boxDeclared = 0
      for (const { item_assessment } of b.items) {
        const cost = item_assessment?.estimated_replace_cost
        if (typeof cost === 'number') boxDeclared += cost
        const flag = item_assessment?.biosecurity_flag
        if (flag === BiosecurityFlag.DECLARE) biosec.declare += 1
        else if (flag === BiosecurityFlag.HIGH_RISK) biosec.high_risk += 1
        else if (flag === BiosecurityFlag.PROHIBITED) biosec.prohibited += 1
      }
      perBoxDeclared[b.box.id] = boxDeclared
      declared_value += boxDeclared
      if (b.cbm) cbm += b.cbm
    }
    return { declared_value, cbm, currency, biosec, perBoxDeclared }
  }, [manifestState])

  const handleLegChange = (legId: string) => {
    const params = new URLSearchParams()
    params.set('leg', legId)
    router.push(`/itinerary?${params.toString()}`)
  }

  const handleGenerateShare = async () => {
    if (!activeShipmentId) return
    setShareLoading(true)
    try {
      const res = await fetch(`/api/shipments/${activeShipmentId}/share-token`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to generate share link')
      const data = (await res.json()) as { token?: string }
      if (data.token) {
        // Resolve a destination URL the user can paste. Public-side route is
        // owned by the parallel builder; we point to /share/<token> on the
        // primary domain — that's the documented public read-only path.
        const url = `${window.location.origin}/share/${data.token}`
        setShareUrl(url)
        try {
          await navigator.clipboard.writeText(url)
          setShareToast(ownerCopy.itinerary.shareCopied)
          setTimeout(() => setShareToast(null), 3000)
        } catch {
          // No clipboard permission — the URL is still shown for manual copy.
        }
      }
    } finally {
      setShareLoading(false)
    }
  }

  const handleConfirmBiosec = async (itemId: string) => {
    setConfirming(itemId)
    // Optimistic: mark confirmed in local state so the rail flips to its
    // confirmed badge without discarding any in-flight inline edits.
    patchAssessment(itemId, { user_confirmed_biosecurity: true })
    try {
      const res = await fetch(`/api/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_confirmed_biosecurity: true }),
      })
      if (!res.ok) throw new Error('confirm failed')
    } catch {
      patchAssessment(itemId, { user_confirmed_biosecurity: false })
    } finally {
      setConfirming(null)
    }
  }

  const toggleBox = (boxId: string) => {
    setOpenBoxIds((prev) => {
      const next = new Set(prev)
      if (next.has(boxId)) next.delete(boxId)
      else next.add(boxId)
      return next
    })
  }

  // -- Inline manifest editing -------------------------------------------------

  /** Apply a partial update to a single item's assessment in local state. */
  const patchAssessment = useCallback(
    (assessmentId: string, patch: Partial<ItemAssessment>) => {
      setManifestState((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          boxes: prev.boxes.map((b) => ({
            ...b,
            items: b.items.map((entry) =>
              entry.item_assessment?.id === assessmentId
                ? {
                    ...entry,
                    item_assessment: { ...entry.item_assessment, ...patch } as ItemAssessment,
                  }
                : entry,
            ),
          })),
        }
      })
    },
    [],
  )

  /** Remove an item entry from a box in local state (verdict downgrade / move out). */
  const removeEntry = useCallback((boxId: string, boxItemId: string) => {
    setManifestState((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        boxes: prev.boxes.map((b) =>
          b.box.id === boxId
            ? { ...b, items: b.items.filter((e) => e.box_item.id !== boxItemId) }
            : b,
        ),
      }
    })
  }, [])

  /** Optimistic PATCH /api/items/:id with per-control busy + rollback. */
  const saveItemField = useCallback(
    async (
      assessmentId: string,
      fieldKey: string,
      patch: Partial<ItemAssessment>,
      prevPatch: Partial<ItemAssessment>,
    ) => {
      setError(fieldKey, null)
      setBusy(fieldKey, true)
      patchAssessment(assessmentId, patch)
      try {
        const res = await fetch(`/api/items/${assessmentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        if (!res.ok) throw new Error('save failed')
        return true
      } catch {
        patchAssessment(assessmentId, prevPatch)
        setError(fieldKey, ownerCopy.itinerary.saveError)
        return false
      } finally {
        setBusy(fieldKey, false)
      }
    },
    [patchAssessment, setBusy, setError],
  )

  const commitVerdictChange = useCallback(
    async (
      box: ManifestBox,
      assessment: ItemAssessment,
      nextVerdict: string,
    ) => {
      const fieldKey = `${assessment.id}:verdict`
      const prevVerdict = assessment.verdict
      const leavesManifest = !SHIPPABLE_VERDICTS.has(nextVerdict)

      setError(fieldKey, null)
      setBusy(fieldKey, true)
      // Optimistic verdict update.
      patchAssessment(assessment.id, { verdict: nextVerdict as Verdict })
      try {
        const res = await fetch(`/api/items/${assessment.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verdict: nextVerdict }),
        })
        if (!res.ok) throw new Error('save failed')
        // Leaving SHIP/CARRY removes the item from this leg's manifest.
        if (leavesManifest) {
          const entry = box.items.find((e) => e.item_assessment?.id === assessment.id)
          if (entry) removeEntry(box.box.id, entry.box_item.id)
        }
      } catch {
        patchAssessment(assessment.id, { verdict: prevVerdict })
        setError(fieldKey, ownerCopy.itinerary.saveError)
      } finally {
        setBusy(fieldKey, false)
      }
    },
    [patchAssessment, removeEntry, setBusy, setError],
  )

  const handleVerdictChange = useCallback(
    (box: ManifestBox, assessment: ItemAssessment, nextVerdict: string, triggerEl: HTMLElement | null) => {
      if (nextVerdict === assessment.verdict) return
      // SHIP↔CARRY commits silently; downgrading away gets a lightweight confirm.
      if (!SHIPPABLE_VERDICTS.has(nextVerdict)) {
        downgradeTriggerRef.current = triggerEl
        const opt = VERDICT_PILL_OPTIONS.find((o) => o.value === nextVerdict)
        setDowngrade({
          itemId: assessment.id,
          boxId: box.box.id,
          boxLabel: box.box.label,
          itemName: assessment.item_name,
          nextVerdict,
          nextVerdictLabel: opt?.label ?? nextVerdict,
        })
        return
      }
      void commitVerdictChange(box, assessment, nextVerdict)
    },
    [commitVerdictChange],
  )

  const confirmDowngrade = useCallback(() => {
    if (!downgrade || !manifestState) return
    const box = manifestState.boxes.find((b) => b.box.id === downgrade.boxId)
    const assessment = box?.items.find(
      (e) => e.item_assessment?.id === downgrade.itemId,
    )?.item_assessment
    if (box && assessment) {
      void commitVerdictChange(box, assessment, downgrade.nextVerdict)
    }
    setDowngrade(null)
  }, [downgrade, manifestState, commitVerdictChange])

  const handleBiosecChange = useCallback(
    (assessment: ItemAssessment, nextFlag: string) => {
      if (nextFlag === (assessment.biosecurity_flag ?? 'none')) return
      void saveItemField(
        assessment.id,
        `${assessment.id}:biosec`,
        { biosecurity_flag: nextFlag as BiosecurityFlag },
        { biosecurity_flag: assessment.biosecurity_flag },
      )
    },
    [saveItemField],
  )

  const handleValueSave = useCallback(
    async (assessment: ItemAssessment, rawValue: string, currency: string) => {
      const fieldKey = `${assessment.id}:value`
      const trimmed = rawValue.trim()
      const parsed = trimmed === '' ? null : Number(trimmed)
      // Validate on blur: reject negative / non-numeric, no request.
      if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
        setError(fieldKey, ownerCopy.itinerary.valueFormatHint)
        return
      }
      const currencyChanged = currency !== (assessment.replace_currency ?? liveTotals.currency)
      const valueChanged = parsed !== (assessment.estimated_replace_cost ?? null)
      if (!valueChanged && !currencyChanged) {
        setError(fieldKey, null)
        return
      }
      const ok = await saveItemField(
        assessment.id,
        fieldKey,
        { estimated_replace_cost: parsed, replace_currency: currency },
        {
          estimated_replace_cost: assessment.estimated_replace_cost,
          replace_currency: assessment.replace_currency,
        },
      )
      if (ok) {
        setSavedTicks((prev) => new Set(prev).add(assessment.id))
        window.setTimeout(() => {
          setSavedTicks((prev) => {
            const next = new Set(prev)
            next.delete(assessment.id)
            return next
          })
        }, 1500)
      }
    },
    [saveItemField, setError, liveTotals.currency],
  )

  const handleNameSave = useCallback(
    async (assessment: ItemAssessment, rawName: string): Promise<boolean> => {
      const fieldKey = `${assessment.id}:name`
      const trimmed = rawName.trim()
      // Name is required — an empty manifest line item is meaningless.
      if (trimmed === '') {
        setError(fieldKey, ownerCopy.itinerary.nameRequired)
        return false
      }
      if (trimmed === assessment.item_name) {
        setError(fieldKey, null)
        return true
      }
      return saveItemField(
        assessment.id,
        fieldKey,
        { item_name: trimmed },
        { item_name: assessment.item_name },
      )
    },
    [saveItemField, setError],
  )

  const handleDescriptionSave = useCallback(
    async (assessment: ItemAssessment, rawDesc: string): Promise<boolean> => {
      const fieldKey = `${assessment.id}:description`
      const trimmed = rawDesc.trim()
      const next = trimmed === '' ? null : trimmed
      if (next === (assessment.item_description ?? null)) {
        setError(fieldKey, null)
        return true
      }
      return saveItemField(
        assessment.id,
        fieldKey,
        { item_description: next },
        { item_description: assessment.item_description },
      )
    },
    [saveItemField, setError],
  )

  const handleBoxMove = useCallback(
    async (fromBox: ManifestBox, boxItemId: string, assessment: ItemAssessment, toBoxId: string) => {
      if (toBoxId === fromBox.box.id) return
      const fieldKey = `${assessment.id}:box`
      setError(fieldKey, null)
      setBusy(fieldKey, true)
      // Snapshot for rollback.
      const snapshot = manifestState
      // Optimistic: move the entry from source to destination box.
      setManifestState((prev) => {
        if (!prev) return prev
        const entry = prev.boxes
          .find((b) => b.box.id === fromBox.box.id)
          ?.items.find((e) => e.box_item.id === boxItemId)
        if (!entry) return prev
        return {
          ...prev,
          boxes: prev.boxes.map((b) => {
            if (b.box.id === fromBox.box.id) {
              return { ...b, items: b.items.filter((e) => e.box_item.id !== boxItemId) }
            }
            if (b.box.id === toBoxId) {
              return {
                ...b,
                items: [...b.items, { ...entry, box_item: { ...entry.box_item, box_id: toBoxId } }],
              }
            }
            return b
          }),
        }
      })
      try {
        const res = await fetch(`/api/boxes/${fromBox.box.id}/items/${boxItemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to_box_id: toBoxId }),
        })
        if (!res.ok) throw new Error('move failed')
      } catch {
        setManifestState(snapshot)
        setError(fieldKey, ownerCopy.itinerary.saveError)
      } finally {
        setBusy(fieldKey, false)
      }
    },
    [manifestState, setBusy, setError],
  )

  const handleRemoveFromBox = useCallback(
    async (boxId: string, boxItemId: string) => {
      const snapshot = manifestState
      removeEntry(boxId, boxItemId)
      try {
        const res = await fetch(`/api/boxes/${boxId}/items/${boxItemId}`, {
          method: 'DELETE',
        })
        if (!res.ok) throw new Error('remove failed')
      } catch {
        setManifestState(snapshot)
      }
    },
    [manifestState, removeEntry],
  )

  const [printDate, setPrintDate] = useState('')

  const handlePrint = () => {
    if (!manifestState) return
    // Stamp the manifest with the date it was produced. Set here (on a user
    // click, client-only) rather than at render time to avoid an SSR/client
    // hydration mismatch on the date.
    setPrintDate(
      new Date().toLocaleDateString('en-IE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    )
    // Snapshot the current open state, expand every box for the print, then
    // restore once the browser print dialog has closed. The browser handles
    // PDF rendering via "Save as PDF" — we just make sure nothing is hidden.
    const previousOpen = openBoxIds
    setOpenBoxIds(new Set(manifestState.boxes.map((b) => b.box.id)))

    // Wait a tick so React commits the expanded state before printing.
    requestAnimationFrame(() => {
      window.print()
      setOpenBoxIds(previousOpen)
    })
  }

  if (shipments.length === 0) {
    return (
      <div className={styles.root}>
        <header className={styles.header}>
          <h1 className={styles.heading}>{ownerCopy.itinerary.heading}</h1>
        </header>
        <div className={styles.emptyWrap}>
          <EmptyState
            variant="branded"
            icon={<Plane size={32} aria-hidden="true" />}
            heading="Itinerary is set up from your move profile"
            description="Once your departure and arrival countries are in place, this is where the per-leg manifests live."
          />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <h1 className={styles.heading}>{ownerCopy.itinerary.heading}</h1>
        </div>
        {shipments.length > 1 && (
          <div className={styles.tabs} role="tablist" aria-label="Shipment legs">
            {shipments.map((s) => (
              <button
                key={s.id}
                role="tab"
                type="button"
                aria-selected={s.id === activeShipmentId}
                className={cn(styles.tab, s.id === activeShipmentId && styles.tabActive)}
                onClick={() => handleLegChange(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {!manifestState || manifestState.boxes.length === 0 ? (
        <div className={styles.emptyWrap}>
          <EmptyState
            variant="branded"
            icon={<Plane size={32} aria-hidden="true" />}
            heading={ownerCopy.itinerary.emptyHeading}
            description={ownerCopy.itinerary.emptyDescription}
          />
        </div>
      ) : (
        <>
          {/* Print-only manifest header — gives the packing company and
              biosecurity a titled, dated document rather than a bare app view. */}
          <div className={styles.printHeader} aria-hidden="true">
            <p className={styles.printTitle}>
              {ownerCopy.itinerary.printManifestTitle}
              {(() => {
                const legLabel = shipments.find((s) => s.id === activeShipmentId)?.label
                return legLabel ? ` — ${legLabel}` : ''
              })()}
            </p>
            <p className={styles.printMeta}>
              {printDate ? `${ownerCopy.itinerary.printPreparedOn(printDate)} · ` : ''}
              {totalItemCount} items · {ownerCopy.itinerary.declaredValue}{' '}
              {formatCurrency(liveTotals.declared_value, liveTotals.currency)} ·{' '}
              {(() => {
                const biosecTotal =
                  liveTotals.biosec.declare +
                  liveTotals.biosec.high_risk +
                  liveTotals.biosec.prohibited
                return `${biosecTotal} biosecurity ${biosecTotal === 1 ? 'item' : 'items'}`
              })()}
            </p>
          </div>

          {/* Totals */}
          <section className={styles.totals} aria-label={ownerCopy.itinerary.totalsLabel}>
            <div className={styles.totalsTile}>
              <span className={styles.totalsLabel}>{ownerCopy.itinerary.declaredValue}</span>
              <span className={styles.totalsValue}>
                {formatCurrency(liveTotals.declared_value, liveTotals.currency)}
              </span>
            </div>
            <div className={styles.totalsTile}>
              <span className={styles.totalsLabel}>{ownerCopy.itinerary.cbm}</span>
              <span className={styles.totalsValue}>
                {liveTotals.cbm.toFixed(2)} m³
              </span>
            </div>
            <div className={styles.totalsTile}>
              <span className={styles.totalsLabel}>{ownerCopy.itinerary.biosecFlags}</span>
              <span className={styles.totalsValue}>
                {liveTotals.biosec.declare +
                  liveTotals.biosec.high_risk +
                  liveTotals.biosec.prohibited}
              </span>
            </div>
            <div className={styles.totalsTile}>
              <span className={styles.totalsLabel}>Items</span>
              <span className={styles.totalsValue}>{totalItemCount}</span>
            </div>
          </section>

          {/* Action row */}
          <section className={styles.actions}>
            <Button
              variant="primary"
              onClick={handleGenerateShare}
              disabled={shareLoading || !activeShipmentId}
            >
              <Copy size={16} aria-hidden="true" />
              {shareLoading ? 'Generating…' : ownerCopy.itinerary.generateShare}
            </Button>
            <a
              className={styles.exportLink}
              href={`/api/shipments/${activeShipmentId}/export`}
              download
            >
              <Download size={16} aria-hidden="true" />
              {ownerCopy.itinerary.exportCsv}
            </a>
            <button
              type="button"
              className={styles.exportLink}
              onClick={handlePrint}
              disabled={!manifestState || manifestState.boxes.length === 0}
            >
              <FileText size={16} aria-hidden="true" />
              {ownerCopy.itinerary.exportPdf}
            </button>
          </section>

          {shareUrl && (
            <div className={styles.shareBanner} role="status">
              <span className={styles.shareUrl}>{shareUrl}</span>
              <button
                type="button"
                className={styles.shareCopyBtn}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareUrl)
                    setShareToast(ownerCopy.itinerary.shareCopied)
                    setTimeout(() => setShareToast(null), 3000)
                  } catch {
                    // No clipboard permission — user can still select+copy manually.
                  }
                }}
              >
                {ownerCopy.itinerary.shareCopyButton}
              </button>
              {shareToast && <span className={styles.shareToast}>{shareToast}</span>}
            </div>
          )}

          {/* Boxes table full-width, biosec declarations stacked below. */}
          <div className={styles.cockpit}>
          {/* Boxes accordion */}
          <section className={styles.boxes} aria-label="Boxes">
            {manifestState.boxes.map((b) => {
              // On desktop the manifest reads as a table — always expanded so
              // the inline grid is visible; the external-link affordance opens
              // the box in packing. On mobile, keep the lightweight accordion.
              const open = isDesktop || openBoxIds.has(b.box.id)
              const itemCountLabel =
                b.items.length === 1 ? ownerCopy.itinerary.item : ownerCopy.itinerary.items
              const boxOptions: BoxSelectOption[] = manifestState.boxes.map((mb) => ({
                id: mb.box.id,
                code: mb.box.label,
                name: mb.box.room_name,
              }))
              return (
                <div key={b.box.id} className={styles.boxRow}>
                  {isDesktop ? (
                    <div className={styles.boxHeaderRow}>
                      <BoxPill code={b.box.label} name={b.box.room_name} className={styles.boxLabel} />
                      <span className={styles.boxMeta}>
                        <span>{b.items.length} {itemCountLabel}</span>
                        <span>•</span>
                        <span>
                          {formatCurrency(
                            liveTotals.perBoxDeclared[b.box.id] ?? 0,
                            liveTotals.currency,
                          )}
                        </span>
                        <button
                          type="button"
                          className={styles.openBoxLink}
                          onClick={() => router.push(`/boxes?box=${b.box.id}`)}
                          aria-label={ownerCopy.itinerary.openBoxInPacking(b.box.label)}
                        >
                          <ExternalLink size={14} aria-hidden="true" />
                        </button>
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.boxHeader}
                      onClick={() => toggleBox(b.box.id)}
                      aria-expanded={open}
                      aria-label={`Toggle ${b.box.label} ${b.box.room_name} item list`}
                    >
                      <BoxPill code={b.box.label} name={b.box.room_name} className={styles.boxLabel} />
                      <span className={styles.boxMeta}>
                        <span>{b.items.length} {itemCountLabel}</span>
                        <span>•</span>
                        <span>
                          {formatCurrency(
                            liveTotals.perBoxDeclared[b.box.id] ?? 0,
                            liveTotals.currency,
                          )}
                        </span>
                        <ChevronDown
                          size={16}
                          aria-hidden="true"
                          className={cn(styles.chevron, open && styles.chevronOpen)}
                        />
                      </span>
                    </button>
                  )}
                  {open && (
                    isDesktop ? (
                      <div role="table" aria-label={`${b.box.label} manifest`} className={styles.itemGrid}>
                        <div role="row" className={styles.colHeader}>
                          <span role="columnheader" className={styles.colHeaderCell}>{ownerCopy.itinerary.colItem}</span>
                          <span role="columnheader" className={styles.colHeaderCell}>{ownerCopy.itinerary.colVerdict}</span>
                          <span role="columnheader" className={cn(styles.colHeaderCell, styles.numCol)}>{ownerCopy.itinerary.colValue}</span>
                          <span role="columnheader" className={styles.colHeaderCell}>{ownerCopy.itinerary.colBox}</span>
                          <span role="columnheader" className={styles.colHeaderCell}>{ownerCopy.itinerary.colBiosec}</span>
                          <span role="columnheader" className={styles.colHeaderCell}>{ownerCopy.itinerary.colActions}</span>
                        </div>
                        {b.items.map(({ box_item, item_assessment }) => (
                          <ItineraryItemRow
                            key={box_item.id}
                            box={b}
                            boxItemId={box_item.id}
                            fallbackName={box_item.item_name}
                            assessment={item_assessment}
                            boxOptions={boxOptions}
                            currency={liveTotals.currency}
                            isDesktop
                            busyFields={busyFields}
                            fieldErrors={fieldErrors}
                            savedTick={item_assessment ? savedTicks.has(item_assessment.id) : false}
                            onVerdictChange={handleVerdictChange}
                            onBiosecChange={handleBiosecChange}
                            onValueSave={handleValueSave}
                            onNameSave={handleNameSave}
                            onDescriptionSave={handleDescriptionSave}
                            onBoxMove={handleBoxMove}
                            onRemoveFromBox={handleRemoveFromBox}
                          />
                        ))}
                      </div>
                    ) : (
                      <ul className={styles.itemCards}>
                        {b.items.map(({ box_item, item_assessment }) => (
                          <li key={box_item.id} className={styles.itemCardWrap}>
                            <ItineraryItemRow
                              box={b}
                              boxItemId={box_item.id}
                              fallbackName={box_item.item_name}
                              assessment={item_assessment}
                              boxOptions={boxOptions}
                              currency={liveTotals.currency}
                              isDesktop={false}
                              busyFields={busyFields}
                              fieldErrors={fieldErrors}
                              savedTick={item_assessment ? savedTicks.has(item_assessment.id) : false}
                              onVerdictChange={handleVerdictChange}
                              onBiosecChange={handleBiosecChange}
                              onValueSave={handleValueSave}
                              onNameSave={handleNameSave}
                              onDescriptionSave={handleDescriptionSave}
                              onBoxMove={handleBoxMove}
                              onRemoveFromBox={handleRemoveFromBox}
                            />
                          </li>
                        ))}
                      </ul>
                    )
                  )}
                </div>
              )
            })}
          </section>

          {/* Biosecurity declarations */}
          {biosecItems.length > 0 && (
            <section className={styles.biosec} aria-labelledby="biosec-heading">
              <h2 id="biosec-heading" className={styles.biosecHeading}>
                <ShieldAlert size={18} aria-hidden="true" />
                {ownerCopy.itinerary.biosecHeading}
              </h2>
              {Array.from(biosecByCategory.entries()).map(([category, rows]) => (
                <div key={category} className={styles.biosecGroup}>
                  <h3 className={styles.biosecCategory}>{category}</h3>
                  <ul className={styles.biosecList}>
                    {rows.map((row) => (
                      <li key={row.itemId} className={styles.biosecItem}>
                        <div>
                          <div className={styles.biosecItemName}>
                            <button
                              type="button"
                              className={styles.biosecItemLink}
                              onClick={() => {
                                if (isDesktop) {
                                  router.push(`/items?item=${row.itemId}`)
                                } else {
                                  router.push(`/decisions/${row.itemId}`)
                                }
                              }}
                              aria-label={`Open ${row.itemName}`}
                            >
                              {row.itemName}
                            </button>
                            <BoxPill
                              code={row.boxLabel}
                              name={row.boxName}
                              size="sm"
                              className={styles.biosecBoxRef}
                            />
                          </div>
                          {row.note && (
                            <p className={styles.biosecNote}>{row.note}</p>
                          )}
                        </div>
                        {row.confirmed ? (
                          <span className={styles.biosecConfirmed}>
                            <Check size={14} aria-hidden="true" />
                            {ownerCopy.itinerary.confirmedBiosec}
                          </span>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleConfirmBiosec(row.itemId)}
                            disabled={confirming === row.itemId}
                          >
                            {confirming === row.itemId
                              ? 'Saving…'
                              : ownerCopy.itinerary.confirmBiosec}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
          </div>
        </>
      )}

      {/* Verdict-downgrade confirm — leaving SHIP/CARRY removes the item. */}
      <ConfirmDialog
        isOpen={downgrade !== null}
        onClose={() => setDowngrade(null)}
        title={
          downgrade
            ? ownerCopy.itinerary.verdictDowngradeTitle(downgrade.itemName, downgrade.nextVerdictLabel)
            : ''
        }
        description={downgrade ? ownerCopy.itinerary.verdictDowngradeBody(downgrade.boxLabel) : ''}
        confirmLabel={ownerCopy.itinerary.changeVerdict}
        cancelLabel={ownerCopy.itinerary.cancel}
        onConfirm={confirmDowngrade}
        triggerRef={downgradeTriggerRef}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline-editable manifest row (desktop grid cell / mobile labelled card)
// ---------------------------------------------------------------------------

interface ItineraryItemRowProps {
  box: ManifestBox
  boxItemId: string
  fallbackName: string | null
  assessment: ItemAssessment | null
  boxOptions: BoxSelectOption[]
  currency: string
  isDesktop: boolean
  busyFields: Set<string>
  fieldErrors: Record<string, string>
  savedTick: boolean
  onVerdictChange: (box: ManifestBox, a: ItemAssessment, next: string, trigger: HTMLElement | null) => void
  onBiosecChange: (a: ItemAssessment, next: string) => void
  onValueSave: (a: ItemAssessment, raw: string, currency: string) => void
  onNameSave: (a: ItemAssessment, raw: string) => Promise<boolean>
  onDescriptionSave: (a: ItemAssessment, raw: string) => void
  onBoxMove: (fromBox: ManifestBox, boxItemId: string, a: ItemAssessment, toBoxId: string) => void
  onRemoveFromBox: (boxId: string, boxItemId: string) => void
}

function ItineraryItemRow({
  box,
  boxItemId,
  fallbackName,
  assessment,
  boxOptions,
  currency,
  isDesktop,
  busyFields,
  fieldErrors,
  savedTick,
  onVerdictChange,
  onBiosecChange,
  onValueSave,
  onNameSave,
  onDescriptionSave,
  onBoxMove,
  onRemoveFromBox,
}: ItineraryItemRowProps) {
  const name = assessment?.item_name ?? fallbackName ?? 'Unnamed item'
  const itemCurrency = assessment?.replace_currency ?? currency
  const serverValue =
    assessment?.estimated_replace_cost != null ? String(assessment.estimated_replace_cost) : ''

  // Local drafts re-seeded during render (React's recommended alternative to a
  // setState-in-effect) whenever the server-confirmed value changes — covers
  // optimistic commits and rollback-after-error without flickering focus mid-edit.
  const [valueDraft, setValueDraft] = useState(serverValue)
  const [lastServerValue, setLastServerValue] = useState(serverValue)
  if (serverValue !== lastServerValue) {
    setLastServerValue(serverValue)
    setValueDraft(serverValue)
  }

  const [currencyDraft, setCurrencyDraft] = useState(itemCurrency)
  const [lastServerCurrency, setLastServerCurrency] = useState(itemCurrency)
  if (itemCurrency !== lastServerCurrency) {
    setLastServerCurrency(itemCurrency)
    setCurrencyDraft(itemCurrency)
  }

  // Name + description drafts — same re-seed-during-render pattern as value.
  const serverName = assessment?.item_name ?? ''
  const [nameDraft, setNameDraft] = useState(serverName)
  const [lastServerName, setLastServerName] = useState(serverName)
  if (serverName !== lastServerName) {
    setLastServerName(serverName)
    setNameDraft(serverName)
  }

  const serverDesc = assessment?.item_description ?? ''
  const [descDraft, setDescDraft] = useState(serverDesc)
  const [lastServerDesc, setLastServerDesc] = useState(serverDesc)
  if (serverDesc !== lastServerDesc) {
    setLastServerDesc(serverDesc)
    setDescDraft(serverDesc)
  }

  // When there's no description, collapse to a "+ Add description" button.
  // Clicking it reveals the textarea (focused via the effect below).
  const [showDescInput, setShowDescInput] = useState(false)
  const descInputRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (showDescInput) descInputRef.current?.focus()
  }, [showDescInput])

  // If the row has no assessment (a bare box_item), there's nothing to edit —
  // render the name and a remove action only.
  if (!assessment) {
    return (
      <div role={isDesktop ? 'row' : undefined} className={isDesktop ? styles.itemGridRow : styles.itemCard}>
        <span role={isDesktop ? 'cell' : undefined} className={styles.itemName}>{name}</span>
        {isDesktop && <span role="cell" /> }
        {isDesktop && <span role="cell" />}
        {isDesktop && <span role="cell" />}
        {isDesktop && <span role="cell" />}
        <span role={isDesktop ? 'cell' : undefined} className={styles.actionsCell}>
          <button
            type="button"
            className={styles.removeBtn}
            onClick={() => onRemoveFromBox(box.box.id, boxItemId)}
            aria-label={ownerCopy.itinerary.removeFromBoxLabel(name, box.box.label)}
          >
            {ownerCopy.itinerary.removeFromBox}
          </button>
        </span>
      </div>
    )
  }

  const a = assessment
  const nameKey = `${a.id}:name`
  const descKey = `${a.id}:description`
  const verdictKey = `${a.id}:verdict`
  const valueKey = `${a.id}:value`
  const boxKey = `${a.id}:box`
  const biosecKey = `${a.id}:biosec`
  const verdictValue = a.verdict ?? 'SHIP'
  const biosecValue = a.biosecurity_flag ?? 'none'

  const nameField = (
    <textarea
      rows={1}
      className={cn(styles.nameInput, fieldErrors[nameKey] && styles.fieldErrorInput)}
      value={nameDraft}
      placeholder={ownerCopy.itinerary.namePlaceholder}
      aria-label={ownerCopy.itinerary.fieldName(name)}
      aria-invalid={fieldErrors[nameKey] ? true : undefined}
      disabled={busyFields.has(nameKey)}
      onChange={(e) => setNameDraft(e.target.value)}
      onKeyDown={(e) => {
        // Names are single-line conceptually — Enter commits (blurs) rather
        // than inserting a newline. The textarea is only used so long names
        // wrap instead of truncating.
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      onBlur={async () => {
        const ok = await onNameSave(a, nameDraft)
        if (!ok) setNameDraft(serverName)
      }}
    />
  )

  const descField = (
    <textarea
      ref={descInputRef}
      rows={1}
      className={cn(styles.descInput, fieldErrors[descKey] && styles.fieldErrorInput)}
      value={descDraft}
      placeholder={ownerCopy.itinerary.descriptionPlaceholder}
      aria-label={ownerCopy.itinerary.fieldDescription(name)}
      aria-invalid={fieldErrors[descKey] ? true : undefined}
      disabled={busyFields.has(descKey)}
      onChange={(e) => setDescDraft(e.target.value)}
      onBlur={() => {
        onDescriptionSave(a, descDraft)
        // Nothing typed — collapse back to the "+ Add description" button.
        if (descDraft.trim() === '') setShowDescInput(false)
      }}
    />
  )

  // Show the textarea when a description exists or the owner is adding one;
  // otherwise a quiet "+ Add description" button keeps the manifest clean.
  const descControl =
    serverDesc !== '' || showDescInput ? (
      descField
    ) : (
      <button
        type="button"
        className={styles.addDescBtn}
        onClick={() => setShowDescInput(true)}
        disabled={busyFields.has(descKey)}
      >
        {ownerCopy.itinerary.addDescription}
      </button>
    )

  const valueField = (
    <div className={styles.valueField}>
      <span className={styles.currencyPrefix} aria-hidden="true">
        {itemCurrency}
      </span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        className={cn(styles.valueInput, fieldErrors[valueKey] && styles.fieldErrorInput)}
        value={valueDraft}
        placeholder={ownerCopy.itinerary.valuePlaceholder}
        aria-label={ownerCopy.itinerary.fieldValue(name)}
        aria-invalid={fieldErrors[valueKey] ? true : undefined}
        disabled={busyFields.has(valueKey)}
        onChange={(e) => setValueDraft(e.target.value)}
        onBlur={() => onValueSave(a, valueDraft, currencyDraft)}
      />
      <CurrencySelect
        value={currencyDraft}
        options={CURRENCY_OPTIONS}
        ariaLabel={`Currency for ${name}`}
        disabled={busyFields.has(valueKey)}
        onChange={(next) => {
          setCurrencyDraft(next)
          onValueSave(a, valueDraft, next)
        }}
      />
      {savedTick && (
        <Check size={14} className={styles.savedTick} aria-hidden="true" />
      )}
    </div>
  )

  const boxField = (
    <BoxSelect
      value={box.box.id}
      options={boxOptions}
      ariaLabel={ownerCopy.itinerary.fieldBox(name)}
      disabled={busyFields.has(boxKey)}
      onChange={(toBoxId) => onBoxMove(box, boxItemId, a, toBoxId)}
    />
  )

  const verdictField = (
    <EditablePill
      value={verdictValue}
      size="md"
      options={VERDICT_PILL_OPTIONS}
      ariaLabel={ownerCopy.itinerary.fieldVerdict(name)}
      listboxLabel={ownerCopy.itinerary.fieldVerdict(name)}
      busy={busyFields.has(verdictKey)}
      onChange={(next) => {
        const trigger = document.activeElement as HTMLElement | null
        onVerdictChange(box, a, next, trigger)
      }}
    />
  )

  const biosecField = (
    <EditablePill
      value={biosecValue}
      size="md"
      options={BIOSEC_PILL_OPTIONS}
      ariaLabel={ownerCopy.itinerary.fieldBiosec(name)}
      listboxLabel={ownerCopy.itinerary.fieldBiosec(name)}
      busy={busyFields.has(biosecKey)}
      onChange={(next) => onBiosecChange(a, next)}
    />
  )

  const removeBtn = (
    <button
      type="button"
      className={styles.removeBtn}
      onClick={() => onRemoveFromBox(box.box.id, boxItemId)}
      aria-label={ownerCopy.itinerary.removeFromBoxLabel(name, box.box.label)}
    >
      {ownerCopy.itinerary.removeFromBox}
    </button>
  )

  const anyError =
    fieldErrors[nameKey] || fieldErrors[descKey] || fieldErrors[verdictKey] ||
    fieldErrors[valueKey] || fieldErrors[boxKey] || fieldErrors[biosecKey]

  if (isDesktop) {
    return (
      <>
        <div role="row" className={styles.itemGridRow}>
          <span role="cell" className={styles.itemName}>{nameField}</span>
          <span role="cell" className={styles.cell}>{verdictField}</span>
          <span role="cell" className={cn(styles.cell, styles.numCol)}>{valueField}</span>
          <span role="cell" className={styles.cell}>{boxField}</span>
          <span role="cell" className={styles.cell}>{biosecField}</span>
          <span role="cell" className={styles.actionsCell}>{removeBtn}</span>
        </div>
        <div className={styles.descRow}>{descControl}</div>
        {anyError && (
          <div role="alert" className={styles.rowError}>
            {anyError}
          </div>
        )}
      </>
    )
  }

  // Mobile — stacked labelled card.
  return (
    <div className={styles.itemCard}>
      <div className={styles.cardTopRow}>
        <span className={styles.itemName}>{nameField}</span>
        {verdictField}
      </div>
      <div className={styles.cardField}>
        {(serverDesc !== '' || showDescInput) && (
          <span className={styles.cellLabel}>{ownerCopy.itinerary.colDescription}</span>
        )}
        {descControl}
      </div>
      <div className={styles.cardField}>
        <span className={styles.cellLabel}>{ownerCopy.itinerary.colValue}</span>
        {valueField}
      </div>
      <div className={styles.cardField}>
        <span className={styles.cellLabel}>{ownerCopy.itinerary.colBox}</span>
        {boxField}
      </div>
      <div className={styles.cardField}>
        <span className={styles.cellLabel}>{ownerCopy.itinerary.colBiosec}</span>
        {biosecField}
      </div>
      <div className={styles.cardActions}>{removeBtn}</div>
      {anyError && (
        <div role="alert" className={styles.rowError}>
          {anyError}
        </div>
      )}
    </div>
  )
}
