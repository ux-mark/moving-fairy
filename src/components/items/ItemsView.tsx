'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ConfirmDialog, Button } from '@thefairies/design-system/components'
import { Camera, Sparkles } from 'lucide-react'

import { useItems } from '@/lib/hooks/useItems'
import { ItemCard } from '@/components/decisions/ItemCard'
import { VerdictPicker } from '@/components/decisions/VerdictPicker'
import { BatchUploadButton } from '@/components/decisions/BatchUploadButton'
import { TextAddInput } from '@/components/decisions/TextAddInput'
import { ListingStatus, Verdict } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { ownerCopy } from '@/lib/copy/owner'
import type { ItemAssessment } from '@/types'
import type { ListingStatus as ListingStatusType } from '@/lib/constants'

import styles from './ItemsView.module.css'

// ── Filter taxonomy ────────────────────────────────────────────────────────
//
// Mapping (verdict + listing_status + is_packed + user_confirmed):
//
//   needs-decision = verdict is null | REVISIT | user_confirmed=false
//   to-pack        = verdict in (SHIP, CARRY) AND !is_packed
//   to-sell        = verdict=SELL AND (no listing OR listing.draft)
//   to-donate      = verdict=DONATE AND !user_confirmed
//   to-discard     = verdict=DISCARD AND !user_confirmed
//   done           = SHIP/CARRY packed OR SELL sold OR DONATE/DISCARD confirmed

export type ItemFilter =
  | 'needs-decision'
  | 'to-pack'
  | 'to-sell'
  | 'to-donate'
  | 'to-discard'
  | 'done'

const FILTERS: { value: ItemFilter; label: string }[] = [
  { value: 'needs-decision', label: ownerCopy.items.filters.needsDecision },
  { value: 'to-pack',        label: ownerCopy.items.filters.toPack },
  { value: 'to-sell',        label: ownerCopy.items.filters.toSell },
  { value: 'to-donate',      label: ownerCopy.items.filters.toDonate },
  { value: 'to-discard',     label: ownerCopy.items.filters.toDiscard },
  { value: 'done',           label: ownerCopy.items.filters.done },
]

export interface ItemWithContext {
  item: ItemAssessment
  listing_status: ListingStatusType | null
  is_packed: boolean
}

function bucketFor(ctx: ItemWithContext): ItemFilter | null {
  const { item, listing_status, is_packed } = ctx
  const verdict = item.verdict
  const confirmed = item.user_confirmed

  // "Done" first — terminal states.
  if (verdict === Verdict.SHIP || verdict === Verdict.CARRY) {
    if (is_packed) return 'done'
    if (verdict && confirmed === false) {
      /* still needs packing — fall through to to-pack */
    }
  }
  if (verdict === Verdict.SELL && listing_status === ListingStatus.SOLD) return 'done'
  if ((verdict === Verdict.DONATE || verdict === Verdict.DISCARD) && confirmed) return 'done'

  // Needs decision: no verdict, REVISIT, or unconfirmed item lacking a verdict
  if (!verdict || verdict === Verdict.REVISIT) return 'needs-decision'

  if (verdict === Verdict.SHIP || verdict === Verdict.CARRY) return 'to-pack'
  if (verdict === Verdict.SELL) {
    if (!listing_status || listing_status === ListingStatus.DRAFT) return 'to-sell'
    // published / reserved → still pending — treat as to-sell so the owner can see it
    if (listing_status === ListingStatus.PUBLISHED || listing_status === ListingStatus.RESERVED) {
      return 'to-sell'
    }
  }
  if (verdict === Verdict.DONATE) return 'to-donate'
  if (verdict === Verdict.DISCARD) return 'to-discard'

  return null
}

function parseFilters(value: string | null): Set<ItemFilter> {
  if (!value) return new Set(['needs-decision'])
  const parts = value.split(',').map((s) => s.trim()).filter(Boolean) as ItemFilter[]
  const valid = new Set(FILTERS.map((f) => f.value))
  const out = parts.filter((p) => valid.has(p as ItemFilter))
  if (out.length === 0) return new Set(['needs-decision'])
  return new Set(out)
}

interface Props {
  profileId: string
  initialItems: ItemWithContext[]
}

export function ItemsView({ profileId, initialItems }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeFilters = parseFilters(searchParams.get('status'))

  // Live items via the existing hook for realtime updates.
  const {
    items: liveItems,
    isLoading,
    error,
    refresh,
    addItemByPhoto,
    addItemByText,
    confirmItem,
    retryAssessment,
    updateVerdict,
  } = useItems(profileId)

  // Merge: prefer live items (realtime) but fall back to the SSR snapshot
  // until the hook finishes its first load, so the page renders instantly.
  const items = liveItems.length > 0 || !isLoading
    ? liveItems
    : initialItems.map((c) => c.item)

  // Re-derive context for each item (listing/packed status is from SSR;
  // realtime updates of the item itself can flip the bucket on the fly).
  const contextByItemId = useMemo(() => {
    const m = new Map<string, ItemWithContext>()
    for (const c of initialItems) m.set(c.item.id, c)
    return m
  }, [initialItems])

  const itemsWithCtx: ItemWithContext[] = useMemo(
    () =>
      items.map((item) => {
        const existing = contextByItemId.get(item.id)
        return {
          item,
          listing_status: existing?.listing_status ?? null,
          is_packed: existing?.is_packed ?? false,
        }
      }),
    [items, contextByItemId],
  )

  const [search, setSearch] = useState('')
  const searchLower = search.trim().toLowerCase()

  const filtered = useMemo(() => {
    const filteredByStatus = itemsWithCtx.filter((ctx) => {
      const bucket = bucketFor(ctx)
      if (!bucket) return false
      return activeFilters.has(bucket)
    })
    if (!searchLower) return filteredByStatus
    return filteredByStatus.filter((ctx) =>
      ctx.item.item_name.toLowerCase().includes(searchLower),
    )
  }, [itemsWithCtx, activeFilters, searchLower])

  const counts = useMemo(() => {
    const c: Record<ItemFilter, number> = {
      'needs-decision': 0, 'to-pack': 0, 'to-sell': 0,
      'to-donate': 0, 'to-discard': 0, 'done': 0,
    }
    for (const ctx of itemsWithCtx) {
      const b = bucketFor(ctx)
      if (b) c[b]++
    }
    return c
  }, [itemsWithCtx])

  const toggleFilter = useCallback(
    (filter: ItemFilter) => {
      const next = new Set(activeFilters)
      if (next.has(filter)) {
        next.delete(filter)
        if (next.size === 0) next.add('needs-decision')
      } else {
        next.add(filter)
      }
      const params = new URLSearchParams(searchParams.toString())
      params.set('status', Array.from(next).join(','))
      router.replace(`/items?${params.toString()}`)
    },
    [activeFilters, router, searchParams],
  )

  // ── Photo / text upload (mirrors DecisionsPage's pattern) ──────────────
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadingCount, setUploadingCount] = useState(0)

  const handleUploadPhotos = async (files: File[]) => {
    setUploadError(null)
    setUploadingCount(files.length)
    const uploads = files.map(async (file) => {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('upload failed')
      const data = (await res.json()) as { url?: string }
      if (!data.url) throw new Error('no url')
      await addItemByPhoto(data.url)
      setUploadingCount((c) => Math.max(0, c - 1))
    })
    const results = await Promise.allSettled(uploads)
    setUploadingCount(0)
    const failures = results.filter((r) => r.status === 'rejected').length
    if (failures > 0) {
      setUploadError(
        `${failures} photo${failures === 1 ? '' : 's'} failed to upload. Try again.`,
      )
    }
  }

  const handleAddByText = async (name: string) => {
    try {
      await addItemByText(name)
      setUploadError(null)
    } catch {
      setUploadError('Failed to add item.')
    }
  }

  // ── Verdict-picker state (inline edit per card) ────────────────────────
  const [pickerItemId, setPickerItemId] = useState<string | null>(null)

  const handleVerdictChange = async (id: string, verdict: string) => {
    await updateVerdict(id, verdict)
    setPickerItemId(null)
  }

  // ── Delete-from-list ───────────────────────────────────────────────────
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deleteDialogTriggerRef = useRef<HTMLButtonElement>(null)

  const itemBeingDeleted = pendingDeleteId
    ? items.find((i) => i.id === pendingDeleteId)
    : undefined
  const deleteItemName = itemBeingDeleted?.item_name || 'this item'

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/items/${pendingDeleteId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? 'Failed to delete item')
      }
      setPendingDeleteId(null)
      refresh()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete item.')
    } finally {
      setIsDeleting(false)
    }
  }

  const hasAnyItems = itemsWithCtx.length > 0

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.heading}>{ownerCopy.items.heading}</h1>
      </header>

      {/* Entry bar (only after at least one item) */}
      {(hasAnyItems || uploadingCount > 0) && (
        <div className={styles.entryBar}>
          <BatchUploadButton onUpload={handleUploadPhotos} disabled={isLoading} />
          <TextAddInput onSubmit={handleAddByText} disabled={isLoading} />
        </div>
      )}

      {/* Filter chips */}
      {hasAnyItems && (
        <div className={styles.filters} role="group" aria-label="Filter items">
          {FILTERS.map((f) => {
            const isActive = activeFilters.has(f.value)
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => toggleFilter(f.value)}
                className={cn(styles.chip, isActive && styles.chipActive)}
              >
                <span>{f.label}</span>
                <span className={styles.chipCount}>({counts[f.value]})</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Search */}
      {hasAnyItems && (
        <div className={styles.searchRow}>
          <input
            type="search"
            className={styles.search}
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search items"
          />
        </div>
      )}

      {uploadError && (
        <div className={styles.banner} role="alert">
          {uploadError}
          <button
            type="button"
            className={styles.bannerDismiss}
            onClick={() => setUploadError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Body */}
      {error ? (
        <div className={styles.errorState} role="alert">
          <p>Something went wrong loading your items.</p>
          <Button variant="secondary" onClick={refresh}>Try again</Button>
        </div>
      ) : !hasAnyItems && uploadingCount === 0 ? (
        // First-run welcome
        <div className={styles.welcome}>
          <div aria-hidden="true" style={{ display: 'none' }}>
            <BatchUploadButton onUpload={handleUploadPhotos} disabled={isLoading} />
          </div>
          <Sparkles className={styles.welcomeIcon} aria-hidden="true" />
          <h2 className={styles.welcomeHeading}>Meet Aisling</h2>
          <p className={styles.welcomeDesc}>
            Snap photos of your things and she&apos;ll help you decide what to
            ship, sell, donate, or leave behind.
          </p>
          <Button
            variant="primary"
            size="lg"
            onClick={() => document.getElementById('batch-upload-trigger')?.click()}
          >
            <Camera size={20} aria-hidden="true" />
            Upload photos
          </Button>
        </div>
      ) : filtered.length === 0 && uploadingCount === 0 ? (
        <div className={styles.emptyFilter} role="status">
          <p>{ownerCopy.items.emptyForFilter}</p>
          <button
            type="button"
            className={styles.clearFilters}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString())
              params.set('status', FILTERS.map((f) => f.value).join(','))
              router.replace(`/items?${params.toString()}`)
            }}
          >
            {ownerCopy.items.clearFilters}
          </button>
        </div>
      ) : (
        <ul className={styles.list} aria-label="Items">
          {filtered.map((ctx) => (
            <li key={ctx.item.id} className={styles.row}>
              <ItemCard
                item={ctx.item}
                onConfirm={(id) => { confirmItem(id).catch(console.error) }}
                onRetry={(id) => { retryAssessment(id).catch(console.error) }}
                onClick={(id) => router.push(`/decisions/${id}`)}
                onVerdictChange={() =>
                  setPickerItemId((prev) => (prev === ctx.item.id ? null : ctx.item.id))
                }
                onDelete={(id) => {
                  setDeleteError(null)
                  setPendingDeleteId(id)
                }}
              />
              {pickerItemId === ctx.item.id && ctx.item.verdict && (
                <div className={styles.pickerWrap}>
                  <VerdictPicker
                    currentVerdict={ctx.item.verdict}
                    isOpen={true}
                    onClose={() => setPickerItemId(null)}
                    onVerdictChange={(v) => handleVerdictChange(ctx.item.id, v)}
                    {...(ctx.item.item_name ? { itemName: ctx.item.item_name } : {})}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        onClose={() => {
          if (!isDeleting) {
            setPendingDeleteId(null)
            setDeleteError(null)
          }
        }}
        title={`Delete "${deleteItemName}"?`}
        description={
          deleteError
            ? `${deleteError} Try again, or keep the item.`
            : "This removes the photo, any chat history, and stops the assessment if it's still queued. This can't be undone."
        }
        confirmLabel="Delete item"
        cancelLabel="Keep item"
        onConfirm={handleConfirmDelete}
        isConfirming={isDeleting}
        variant="danger"
        triggerRef={deleteDialogTriggerRef}
      />
    </div>
  )
}
