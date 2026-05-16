'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@thefairies/design-system/components'

import { Field } from '@/components/shared/Field'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { ownerCopy } from '@/lib/copy/owner'
import { cn } from '@/lib/utils'
import { ListingCondition, ShipmentStatus } from '@/lib/constants'
import { getCountryName } from '@/lib/countries'
import type { DiscountTier, SellerSettings, Shipment } from '@/types/database'
import type { Country } from '@/lib/constants'

import styles from './SettingsView.module.css'

type TabKey = 'sale' | 'shipments' | 'biosecurity' | 'account'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'sale',        label: ownerCopy.settings.tabs.sale },
  { key: 'shipments',   label: ownerCopy.settings.tabs.shipments },
  { key: 'biosecurity', label: ownerCopy.settings.tabs.biosecurity },
  { key: 'account',     label: ownerCopy.settings.tabs.account },
]

const CURRENCIES = ['USD', 'EUR', 'AUD'] as const

const CONDITION_OPTIONS = [
  { value: ListingCondition.EXCELLENT, label: ownerCopy.selling.conditionLabels.excellent },
  { value: ListingCondition.LIKE_NEW,  label: ownerCopy.selling.conditionLabels.like_new },
  { value: ListingCondition.GOOD,      label: ownerCopy.selling.conditionLabels.good },
  { value: ListingCondition.FAIR,      label: ownerCopy.selling.conditionLabels.fair },
] as const

const SHIPMENT_STATUS_OPTIONS = [
  { value: ShipmentStatus.PLANNED, label: 'Planned' },
  { value: ShipmentStatus.IN_TRANSIT, label: 'In transit' },
  { value: ShipmentStatus.ARRIVED, label: 'Arrived' },
  { value: ShipmentStatus.CANCELLED, label: 'Cancelled' },
] as const

interface Props {
  email: string
  settings: SellerSettings
  shipments: Shipment[]
  arrivalCountry: Country
  onwardCountry: Country | null
}

export function SettingsView({
  email,
  settings,
  shipments,
  arrivalCountry,
  onwardCountry,
}: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('sale')
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.heading}>{ownerCopy.settings.heading}</h1>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Settings sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={activeTab === t.key}
            className={cn(styles.tab, activeTab === t.key && styles.tabActive)}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {toast && (
        <div className={styles.bannerSuccess} role="status">
          {toast}
        </div>
      )}
      {error && (
        <div className={styles.bannerError} role="alert">
          {error}
        </div>
      )}

      {activeTab === 'sale' && (
        <SaleDefaultsTab
          settings={settings}
          onSaved={() => {
            setToast(ownerCopy.settings.sale.saveToast)
            setError(null)
            router.refresh()
            window.setTimeout(() => setToast(null), 2500)
          }}
          onError={(msg) => {
            setError(msg)
            setToast(null)
          }}
        />
      )}

      {activeTab === 'shipments' && (
        <ShipmentsTab
          shipments={shipments}
          onSaved={() => {
            setToast('Shipment saved.')
            setError(null)
            router.refresh()
            window.setTimeout(() => setToast(null), 2500)
          }}
          onError={(msg) => {
            setError(msg)
            setToast(null)
          }}
        />
      )}

      {activeTab === 'biosecurity' && (
        <BiosecurityTab
          settings={settings}
          arrivalCountry={arrivalCountry}
          onwardCountry={onwardCountry}
        />
      )}

      {activeTab === 'account' && <AccountTab email={email} />}
    </div>
  )
}

// ── Sale defaults ──────────────────────────────────────────────────────────

interface SaleProps {
  settings: SellerSettings
  onSaved: () => void
  onError: (msg: string) => void
}

function SaleDefaultsTab({ settings, onSaved, onError }: SaleProps) {
  const [currency, setCurrency] = useState(settings.currency)
  const [sellerName, setSellerName] = useState(settings.seller_display_name ?? '')
  const [contactEmail, setContactEmail] = useState(settings.contact_email ?? '')
  const [pickup, setPickup] = useState(settings.pickup_location_copy ?? '')
  const [tiers, setTiers] = useState<DiscountTier[]>(settings.discount_tiers)
  const [saving, setSaving] = useState(false)

  const updateTier = (idx: number, patch: Partial<DiscountTier>) => {
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Validation: tiers must have numeric min and percent
      for (const t of tiers) {
        if (Number.isNaN(t.min) || Number.isNaN(t.percent)) {
          throw new Error('Discount tiers must be numeric.')
        }
        if (t.max !== null && Number.isNaN(t.max)) {
          throw new Error('Discount tiers max must be numeric or empty.')
        }
      }
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currency,
          seller_display_name: sellerName.trim() || null,
          contact_email: contactEmail.trim() || null,
          pickup_location_copy: pickup.trim() || null,
          discount_tiers: tiers,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? 'Failed to save settings')
      }
      onSaved()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="sale-heading">
      <h2 id="sale-heading" className={styles.panelHeading}>
        {ownerCopy.settings.tabs.sale}
      </h2>

      <div className={styles.formGrid}>
        <Field label={ownerCopy.settings.sale.currency} htmlFor="set-currency">
          <select
            id="set-currency"
            className={styles.select}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label={ownerCopy.settings.sale.sellerName} htmlFor="set-seller">
          <input
            id="set-seller"
            type="text"
            className={styles.input}
            value={sellerName}
            onChange={(e) => setSellerName(e.target.value)}
            autoComplete="name"
          />
        </Field>

        <Field label={ownerCopy.settings.sale.contactEmail} htmlFor="set-contact">
          <input
            id="set-contact"
            type="email"
            className={styles.input}
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
          />
        </Field>

        <Field
          label={ownerCopy.settings.sale.pickupLocation}
          htmlFor="set-pickup"
          hint={ownerCopy.settings.sale.pickupHelper}
        >
          <textarea
            id="set-pickup"
            className={styles.textarea}
            rows={3}
            value={pickup}
            onChange={(e) => setPickup(e.target.value)}
          />
        </Field>

        <Field
          label={ownerCopy.settings.sale.discountTiers}
          hint={ownerCopy.settings.sale.discountHelper}
        >
          <div className={styles.tiers}>
            {tiers.map((t, idx) => (
              <div key={idx} className={styles.tierRow}>
                <label className={styles.tierField}>
                  <span className={styles.tierLabel}>From</span>
                  <input
                    type="number"
                    min="1"
                    className={styles.tierInput}
                    value={t.min}
                    onChange={(e) =>
                      updateTier(idx, { min: Number(e.target.value) })
                    }
                  />
                </label>
                <label className={styles.tierField}>
                  <span className={styles.tierLabel}>To</span>
                  <input
                    type="number"
                    min="1"
                    className={styles.tierInput}
                    value={t.max ?? ''}
                    placeholder="∞"
                    onChange={(e) =>
                      updateTier(idx, {
                        max: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className={styles.tierField}>
                  <span className={styles.tierLabel}>% off</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className={styles.tierInput}
                    value={t.percent}
                    onChange={(e) =>
                      updateTier(idx, { percent: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
            ))}
          </div>
        </Field>

        <Field
          label={ownerCopy.settings.sale.defaultCondition}
          htmlFor="set-default-cond"
        >
          {/* Stored on the listing itself, but useful as a per-user default
              when creating new ones in future. For now this is a placeholder
              control rendered for visual completeness. */}
          <select
            id="set-default-cond"
            className={styles.select}
            disabled
            defaultValue=""
          >
            <option value="">— Pick on each listing —</option>
            {CONDITION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className={styles.actions}>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </section>
  )
}

// ── Shipments ──────────────────────────────────────────────────────────────

interface ShipmentsProps {
  shipments: Shipment[]
  onSaved: () => void
  onError: (msg: string) => void
}

function ShipmentsTab({ shipments, onSaved, onError }: ShipmentsProps) {
  return (
    <section className={styles.panel} aria-labelledby="ships-heading">
      <h2 id="ships-heading" className={styles.panelHeading}>
        {ownerCopy.settings.tabs.shipments}
      </h2>
      {shipments.length === 0 ? (
        <p className={styles.muted}>No shipments configured yet.</p>
      ) : (
        <ul className={styles.shipmentList}>
          {shipments.map((s) => (
            <ShipmentRow key={s.id} shipment={s} onSaved={onSaved} onError={onError} />
          ))}
        </ul>
      )}
    </section>
  )
}

function ShipmentRow({
  shipment,
  onSaved,
  onError,
}: {
  shipment: Shipment
  onSaved: () => void
  onError: (msg: string) => void
}) {
  const [label, setLabel] = useState(shipment.label)
  const [status, setStatus] = useState(shipment.status)
  const [targetDate, setTargetDate] = useState(shipment.target_date ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/shipments/${shipment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: label.trim(),
          status,
          target_date: targetDate || null,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? 'Failed to save')
      }
      onSaved()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className={styles.shipmentRow}>
      <div className={styles.shipmentFields}>
        <Field label={ownerCopy.settings.shipments.label} htmlFor={`label-${shipment.id}`}>
          <input
            id={`label-${shipment.id}`}
            type="text"
            className={styles.input}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>
        <Field label={ownerCopy.settings.shipments.targetDate} htmlFor={`date-${shipment.id}`}>
          <input
            id={`date-${shipment.id}`}
            type="date"
            className={styles.input}
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </Field>
        <Field label={ownerCopy.settings.shipments.status} htmlFor={`status-${shipment.id}`}>
          <select
            id={`status-${shipment.id}`}
            className={styles.select}
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            {SHIPMENT_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className={styles.shipmentActions}>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </li>
  )
}

// ── Biosecurity ───────────────────────────────────────────────────────────

function BiosecurityTab({
  settings,
  arrivalCountry,
  onwardCountry,
}: {
  settings: SellerSettings
  arrivalCountry: Country
  onwardCountry: Country | null
}) {
  const preset =
    settings.biosecurity_destination_preset ??
    (onwardCountry ? getCountryName(onwardCountry) : getCountryName(arrivalCountry))

  return (
    <section className={styles.panel} aria-labelledby="bio-heading">
      <h2 id="bio-heading" className={styles.panelHeading}>
        {ownerCopy.settings.tabs.biosecurity}
      </h2>
      <dl className={styles.descList}>
        <div>
          <dt className={styles.descTerm}>
            {ownerCopy.settings.biosecurity.destinationLabel}
          </dt>
          <dd className={styles.descDef}>{preset}</dd>
        </div>
      </dl>
      <p className={styles.muted}>{ownerCopy.settings.biosecurity.destinationHelper}</p>
      <p className={styles.muted}>{ownerCopy.settings.biosecurity.info}</p>
    </section>
  )
}

// ── Account ───────────────────────────────────────────────────────────────

function AccountTab({ email }: { email: string }) {
  return (
    <section className={styles.panel} aria-labelledby="account-heading">
      <h2 id="account-heading" className={styles.panelHeading}>
        {ownerCopy.settings.tabs.account}
      </h2>
      <dl className={styles.descList}>
        <div>
          <dt className={styles.descTerm}>{ownerCopy.settings.account.email}</dt>
          <dd className={styles.descDef}>{email}</dd>
        </div>
      </dl>
      <div className={styles.actions}>
        <SignOutButton />
      </div>
    </section>
  )
}
