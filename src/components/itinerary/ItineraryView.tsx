'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plane,
  Copy,
  Download,
  FileText,
  ShieldAlert,
  Check,
  ChevronDown,
} from 'lucide-react'
import { Button, EmptyState } from '@thefairies/design-system/components'

import { cn } from '@/lib/utils'
import { ownerCopy } from '@/lib/copy/owner'
import { BiosecurityFlag } from '@/lib/constants'
import type { Manifest } from '@/mcp/shipments'
import type { Shipment } from '@/types/database'

import styles from './ItineraryView.module.css'

interface Props {
  shipments: Shipment[]
  activeShipmentId: string | null
  manifest: Manifest | null
}

const BIOSEC_LABELS: Record<string, string> = {
  declare: 'Declare',
  high_risk: 'High risk',
  prohibited: 'Prohibited',
}

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

export function ItineraryView({ shipments, activeShipmentId, manifest }: Props) {
  const router = useRouter()
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareToast, setShareToast] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [openBoxIds, setOpenBoxIds] = useState<Set<string>>(new Set())

  const totalItemCount = useMemo(() => {
    if (!manifest) return 0
    return manifest.boxes.reduce((sum, b) => sum + b.items.length, 0)
  }, [manifest])

  const biosecItems = useMemo(() => {
    if (!manifest) return []
    const all: Array<{
      boxLabel: string
      itemName: string
      itemId: string
      flag: string
      category: string | null
      note: string | null
      confirmed: boolean
    }> = []
    for (const b of manifest.boxes) {
      for (const { item_assessment } of b.items) {
        if (!item_assessment) continue
        const flag = item_assessment.biosecurity_flag
        if (!flag || flag === BiosecurityFlag.NONE) continue
        all.push({
          boxLabel: b.box.label,
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
  }, [manifest])

  const biosecByCategory = useMemo(() => {
    const map = new Map<string, typeof biosecItems>()
    for (const row of biosecItems) {
      const key = row.category ?? 'other'
      if (!map.has(key)) map.set(key, [])
      map.get(key)?.push(row)
    }
    return map
  }, [biosecItems])

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
    try {
      const res = await fetch(`/api/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_confirmed_biosecurity: true }),
      })
      if (res.ok) router.refresh()
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

      {!manifest || manifest.boxes.length === 0 ? (
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
          {/* Totals */}
          <section className={styles.totals} aria-label={ownerCopy.itinerary.totalsLabel}>
            <div className={styles.totalsTile}>
              <span className={styles.totalsLabel}>{ownerCopy.itinerary.declaredValue}</span>
              <span className={styles.totalsValue}>
                {formatCurrency(manifest.totals.declared_value, manifest.totals.currency)}
              </span>
            </div>
            <div className={styles.totalsTile}>
              <span className={styles.totalsLabel}>{ownerCopy.itinerary.cbm}</span>
              <span className={styles.totalsValue}>
                {manifest.totals.cbm.toFixed(2)} m³
              </span>
            </div>
            <div className={styles.totalsTile}>
              <span className={styles.totalsLabel}>{ownerCopy.itinerary.biosecFlags}</span>
              <span className={styles.totalsValue}>
                {manifest.totals.biosecurity_counts.declare +
                  manifest.totals.biosecurity_counts.high_risk +
                  manifest.totals.biosecurity_counts.prohibited}
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
            <button type="button" className={styles.exportLinkDisabled} disabled>
              <FileText size={16} aria-hidden="true" />
              {ownerCopy.itinerary.exportPdf}
            </button>
          </section>

          {shareUrl && (
            <div className={styles.shareBanner} role="status">
              <span className={styles.shareUrl}>{shareUrl}</span>
              {shareToast && <span className={styles.shareToast}>{shareToast}</span>}
            </div>
          )}

          {/* Boxes accordion */}
          <section className={styles.boxes} aria-label="Boxes">
            {manifest.boxes.map((b) => {
              const open = openBoxIds.has(b.box.id)
              const itemCountLabel =
                b.items.length === 1 ? ownerCopy.itinerary.item : ownerCopy.itinerary.items
              return (
                <div key={b.box.id} className={styles.boxRow}>
                  <button
                    type="button"
                    className={styles.boxHeader}
                    onClick={() => toggleBox(b.box.id)}
                    aria-expanded={open}
                  >
                    <span className={styles.boxLabel}>{b.box.label}</span>
                    <span className={styles.boxMeta}>
                      <span>{b.items.length} {itemCountLabel}</span>
                      <span>•</span>
                      <span>
                        {formatCurrency(b.declared_value, manifest.totals.currency)}
                      </span>
                      <ChevronDown
                        size={16}
                        aria-hidden="true"
                        className={cn(styles.chevron, open && styles.chevronOpen)}
                      />
                    </span>
                  </button>
                  {open && (
                    <ul className={styles.itemsList}>
                      {b.items.map(({ box_item, item_assessment }) => {
                        const name =
                          item_assessment?.item_name ?? box_item.item_name ?? 'Unnamed item'
                        const cost = item_assessment?.estimated_replace_cost
                        const currency = item_assessment?.replace_currency ?? manifest.totals.currency
                        const flag = item_assessment?.biosecurity_flag
                        return (
                          <li key={box_item.id} className={styles.itemRow}>
                            <span className={styles.itemName}>{name}</span>
                            {flag && flag !== BiosecurityFlag.NONE && (
                              <span className={styles.biosecChip}>
                                <ShieldAlert size={12} aria-hidden="true" />
                                {BIOSEC_LABELS[flag] ?? flag}
                              </span>
                            )}
                            {typeof cost === 'number' && (
                              <span className={styles.itemValue}>
                                {formatCurrency(cost, currency)}
                              </span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
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
                            {row.itemName}
                            <span className={styles.biosecBoxRef}>{row.boxLabel}</span>
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
        </>
      )}
    </div>
  )
}
