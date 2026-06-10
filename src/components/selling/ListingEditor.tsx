'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft,
  Upload,
  X,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Tag,
} from 'lucide-react'
import { Button, ConfirmDialog } from '@thefairies/design-system/components'

import { CategoryPicker } from '@/components/shared/CategoryPicker'
import { Field } from '@/components/shared/Field'
import { PlantCareEditor } from '@/components/shared/PlantCareEditor'
import { proxyImageUrl } from '@/lib/storage-url'
import {
  ListingCondition,
  ListingStatus,
} from '@/lib/constants'
import { ownerCopy } from '@/lib/copy/owner'
import type { ItemAssessment, Listing, PlantCare } from '@/types/database'

import styles from './ListingEditor.module.css'

interface Props {
  listing: Listing
  item: ItemAssessment
}

const CURRENCIES = ['USD', 'EUR', 'AUD'] as const

const CONDITION_OPTIONS = [
  { value: ListingCondition.EXCELLENT, label: ownerCopy.selling.conditionLabels.excellent },
  { value: ListingCondition.LIKE_NEW,  label: ownerCopy.selling.conditionLabels.like_new },
  { value: ListingCondition.GOOD,      label: ownerCopy.selling.conditionLabels.good },
  { value: ListingCondition.FAIR,      label: ownerCopy.selling.conditionLabels.fair },
] as const

const STATUS_OPTIONS = [
  { value: ListingStatus.DRAFT,     label: ownerCopy.selling.status.draft },
  { value: ListingStatus.PUBLISHED, label: ownerCopy.selling.status.published },
  { value: ListingStatus.RESERVED,  label: ownerCopy.selling.status.reserved },
  { value: ListingStatus.SOLD,      label: ownerCopy.selling.status.sold },
] as const

function publicListingUrl(slug: string): string {
  if (typeof window === 'undefined') return ''
  const host = window.location.hostname
  const proto = window.location.protocol
  if (host === 'localhost' || host === '127.0.0.1') {
    return `${proto}//sale.localhost:${window.location.port || '3000'}/${slug}`
  }
  return `https://sale.thefairies.ie/${slug}`
}

export function ListingEditor({ listing, item }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(item.item_name)
  const [price, setPrice] = useState<string>(
    listing.asking_price !== null ? String(listing.asking_price) : '',
  )
  const [currency, setCurrency] = useState(listing.currency)
  const [condition, setCondition] = useState<string>(listing.condition ?? '')
  const [category, setCategory] = useState<string | null>(item.category ?? null)
  const [care, setCare] = useState<PlantCare | null>(item.care ?? null)
  // Master list is fetched once on mount — categories are seller-scoped and
  // change rarely. Empty initial state shows just "No category" + "Add new…"
  // until the fetch resolves; safe because the picker handles both shapes.
  const [categories, setCategories] = useState<string[]>([])
  const [brand, setBrand] = useState(listing.brand ?? '')
  const [modelName, setModelName] = useState(listing.model_name ?? '')
  const [dimensions, setDimensions] = useState(listing.dimensions ?? '')
  const [included, setIncluded] = useState(listing.included ?? '')
  const [details, setDetails] = useState(listing.details ?? '')
  const [status, setStatus] = useState(listing.listing_status)
  const [images, setImages] = useState<string[]>(
    item.images && item.images.length > 0
      ? item.images
      : item.image_url
      ? [item.image_url]
      : [],
  )

  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [marking, setMarking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const deleteButtonRef = useRef<HTMLButtonElement>(null)

  // Dismiss the toast after a few seconds for visual confirmation.
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(t)
  }, [toast])

  // Load the seller's master category list so the picker can render the
  // available options. Categories are stable enough that a one-shot fetch
  // is fine — adding a new one updates `categories` locally inline.
  useEffect(() => {
    let cancelled = false
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        const list = (data as { categories?: unknown }).categories
        if (Array.isArray(list) && list.every((c) => typeof c === 'string')) {
          setCategories(list as string[])
        }
      })
      .catch(() => {
        // Non-fatal — the picker still works for "No category" + "Add new…".
      })
    return () => {
      cancelled = true
    }
  }, [])

  const persistImages = async (next: string[]) => {
    setImages(next)
    const res = await fetch(`/api/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: next }),
    })
    if (!res.ok) {
      setError(ownerCopy.selling.uploadFailed)
    }
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    setError(null)
    const next = [...images]
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        if (!res.ok) throw new Error('upload failed')
        const data = (await res.json()) as { url?: string }
        if (data.url) next.push(data.url)
      }
      await persistImages(next)
    } catch {
      setError(ownerCopy.selling.uploadFailed)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeImage = async (idx: number) => {
    const next = images.filter((_, i) => i !== idx)
    await persistImages(next)
  }

  const moveImage = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= images.length) return
    const next = [...images]
    const [m] = next.splice(idx, 1)
    if (m === undefined) return
    next.splice(target, 0, m)
    await persistImages(next)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      // Collect any item-level changes (name, category, care) into a single
      // PATCH. Listing-level fields go to /api/listings below.
      const itemChanges: Record<string, unknown> = {}
      if (name.trim() && name.trim() !== item.item_name) {
        itemChanges.item_name = name.trim()
      }
      if (category !== (item.category ?? null)) {
        itemChanges.category = category
      }
      // Compare care via JSON identity. PlantCareEditor normalises to a
      // canonical shape (empty fields stripped, or null when fully cleared),
      // so a string-equal comparison is safe and avoids deep-equal churn.
      if (JSON.stringify(care) !== JSON.stringify(item.care ?? null)) {
        itemChanges.care = care
      }
      if (Object.keys(itemChanges).length > 0) {
        const res = await fetch(`/api/items/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(itemChanges),
        })
        if (!res.ok) throw new Error('Failed to save item details')
      }

      const parsedPrice = price.trim() === '' ? null : Number(price)
      if (parsedPrice !== null && (Number.isNaN(parsedPrice) || parsedPrice < 0)) {
        throw new Error('Price must be a positive number')
      }

      const body = {
        asking_price: parsedPrice,
        currency,
        condition: condition === '' ? null : condition,
        brand: brand.trim() || null,
        model_name: modelName.trim() || null,
        dimensions: dimensions.trim() || null,
        included: included.trim() || null,
        details: details.trim() || null,
        listing_status: status,
      }

      const res = await fetch(`/api/listings/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? 'Failed to save')
      }
      setToast(ownerCopy.selling.savedToast)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleMarkSold = async () => {
    setMarking(true)
    setError(null)
    try {
      const res = await fetch(`/api/listings/${listing.id}/mark-sold`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to mark sold')
      setStatus(ListingStatus.SOLD)
      setToast(ownerCopy.selling.soldToast)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark sold')
    } finally {
      setMarking(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/listings/${listing.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      router.push('/selling')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
      setDeleting(false)
      setConfirmDeleteOpen(false)
    }
  }

  const isLive =
    status === ListingStatus.PUBLISHED || status === ListingStatus.RESERVED

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Link href="/selling" className={styles.back}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back to selling
        </Link>
        <h1 className={styles.heading}>{name || 'Listing'}</h1>
        <p className={styles.slug}>/{listing.slug}</p>
      </header>

      {error && (
        <div className={styles.banner} role="alert">
          {error}
        </div>
      )}

      {toast && (
        <div className={styles.bannerSuccess} role="status">
          {toast}
        </div>
      )}

      {/* Photos */}
      <section className={styles.section} aria-labelledby="photos-heading">
        <h2 id="photos-heading" className={styles.sectionHeading}>
          {ownerCopy.selling.fields.photos}
        </h2>
        <div className={styles.photoGrid}>
          {images.map((url, idx) => (
            <div key={`${url}-${idx}`} className={styles.photoTile}>
              <div className={styles.photoImgWrap}>
                <Image
                  src={proxyImageUrl(url)}
                  alt={`${name || 'Listing'} photo ${idx + 1}`}
                  fill
                  sizes="(min-width: 768px) 200px, 33vw"
                  className={styles.photoImg}
                  unoptimized
                />
              </div>
              <div className={styles.photoActions}>
                <button
                  type="button"
                  className={styles.photoBtn}
                  onClick={() => moveImage(idx, -1)}
                  disabled={idx === 0}
                  aria-label="Move photo up"
                >
                  <ChevronUp size={16} aria-hidden="true" />
                  Up
                </button>
                <button
                  type="button"
                  className={styles.photoBtn}
                  onClick={() => moveImage(idx, 1)}
                  disabled={idx === images.length - 1}
                  aria-label="Move photo down"
                >
                  <ChevronDown size={16} aria-hidden="true" />
                  Down
                </button>
                <button
                  type="button"
                  className={styles.photoBtnDanger}
                  onClick={() => removeImage(idx)}
                  aria-label="Remove photo"
                >
                  <X size={16} aria-hidden="true" />
                  Remove
                </button>
              </div>
            </div>
          ))}
          <label className={styles.photoUpload}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => handleFiles(e.target.files)}
              disabled={uploading}
            />
            <span className={styles.photoUploadInner}>
              <Upload size={20} aria-hidden="true" />
              <span>{uploading ? 'Uploading…' : 'Add photos'}</span>
            </span>
          </label>
        </div>
      </section>

      {/* Form fields */}
      <section className={styles.section}>
        <Field label={ownerCopy.selling.fields.itemName} htmlFor="listing-name">
          <input
            id="listing-name"
            type="text"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </Field>

        <div className={styles.row}>
          <Field
            label={ownerCopy.selling.fields.price}
            htmlFor="listing-price"
            className={styles.flex2}
          >
            <input
              id="listing-price"
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              className={styles.input}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 120"
            />
          </Field>
          <Field
            label={ownerCopy.selling.fields.currency}
            htmlFor="listing-currency"
            className={styles.flex1}
          >
            <select
              id="listing-currency"
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
        </div>

        <Field label={ownerCopy.selling.fields.condition} htmlFor="listing-condition">
          <select
            id="listing-condition"
            className={styles.select}
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
          >
            <option value="">— Not specified —</option>
            {CONDITION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label={ownerCopy.selling.fields.category} htmlFor="listing-category">
          <CategoryPicker
            selectId="listing-category"
            value={category}
            categories={categories}
            onChange={setCategory}
            onCategoriesUpdated={setCategories}
            selectClassName={styles.select}
            inputClassName={styles.input}
            disabled={saving}
          />
        </Field>

        {/* Plant care — visible only for plants (by category or biosec class).
            Reacts to the live category select so toggling to "Plants" reveals
            the editor immediately, without waiting on a save round-trip. */}
        {(category === 'Plants' ||
          item.biosecurity_category === 'plant_matter') && (
          <PlantCareEditor
            value={care}
            onChange={setCare}
            disabled={saving}
            inputClassName={styles.input}
            selectClassName={styles.select}
            textareaClassName={styles.textarea}
          />
        )}

        <div className={styles.row}>
          <Field label={ownerCopy.selling.fields.brand} htmlFor="listing-brand" className={styles.flex1}>
            <input
              id="listing-brand"
              type="text"
              className={styles.input}
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            />
          </Field>
          <Field label={ownerCopy.selling.fields.modelName} htmlFor="listing-model" className={styles.flex1}>
            <input
              id="listing-model"
              type="text"
              className={styles.input}
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
            />
          </Field>
        </div>

        <Field label={ownerCopy.selling.fields.dimensions} htmlFor="listing-dim">
          <input
            id="listing-dim"
            type="text"
            className={styles.input}
            value={dimensions}
            onChange={(e) => setDimensions(e.target.value)}
            placeholder="e.g. 60 × 40 × 30 cm"
          />
        </Field>

        <Field label={ownerCopy.selling.fields.included} htmlFor="listing-included">
          <textarea
            id="listing-included"
            className={styles.textarea}
            value={included}
            onChange={(e) => setIncluded(e.target.value)}
            rows={2}
            placeholder="e.g. Charger, original box, manual"
          />
        </Field>

        <Field label={ownerCopy.selling.fields.details} htmlFor="listing-details">
          <textarea
            id="listing-details"
            className={styles.textarea}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={4}
          />
        </Field>

        <Field label={ownerCopy.selling.fields.status} htmlFor="listing-status">
          <select
            id="listing-status"
            className={styles.select}
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
      </section>

      {/* Actions */}
      <section className={styles.actions}>
        <button
          ref={deleteButtonRef}
          type="button"
          className={styles.deleteBtn}
          onClick={() => setConfirmDeleteOpen(true)}
          disabled={deleting}
        >
          {deleting ? 'Deleting…' : ownerCopy.selling.actions.delete}
        </button>
        <div className={styles.actionsRight}>
          {isLive && (
            <Button
              variant="secondary"
              onClick={handleMarkSold}
              disabled={marking}
            >
              <Tag size={16} aria-hidden="true" />
              {marking ? 'Marking…' : ownerCopy.selling.actions.markSold}
            </Button>
          )}
          {(status === ListingStatus.PUBLISHED || status === ListingStatus.RESERVED) && (
            <a
              className={styles.viewLink}
              href={publicListingUrl(listing.slug)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={16} aria-hidden="true" />
              {ownerCopy.selling.actions.viewPublic}
            </a>
          )}
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : ownerCopy.selling.actions.save}
          </Button>
        </div>
      </section>

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="Delete this listing?"
        description="The underlying item stays in your Items list."
        confirmLabel="Delete listing"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        isConfirming={deleting}
        triggerRef={deleteButtonRef}
      />
    </div>
  )
}
