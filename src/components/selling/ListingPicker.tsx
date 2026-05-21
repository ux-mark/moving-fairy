'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Tag, ArrowLeft } from 'lucide-react'
import { Button, EmptyState } from '@thefairies/design-system/components'

import { proxyImageUrl } from '@/lib/storage-url'
import { ownerCopy } from '@/lib/copy/owner'

import styles from './ListingPicker.module.css'

interface EligibleItem {
  id: string
  item_name: string
  image_url: string | null
  images: string[]
  estimated_replace_cost: number | null
  replace_currency: string | null
}

interface Props {
  eligible: EligibleItem[]
}

export function ListingPicker({ eligible }: Props) {
  const router = useRouter()
  const [creating, setCreating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handlePick = async (itemId: string) => {
    setCreating(itemId)
    setError(null)
    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_assessment_id: itemId }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? 'Failed to create listing')
      }
      const listing = (await res.json()) as { id: string }
      router.push(`/selling/${listing.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create listing')
      setCreating(null)
    }
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Link href="/selling" className={styles.back}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back to selling
        </Link>
        <h1 className={styles.heading}>{ownerCopy.selling.pickerHeading}</h1>
      </header>

      {error && (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      )}

      {eligible.length === 0 ? (
        <div className={styles.emptyWrap}>
          <EmptyState
            variant="branded"
            icon={<Tag size={32} aria-hidden="true" />}
            heading="No items waiting to be listed"
            description={ownerCopy.selling.pickerEmpty}
            ctaLabel="Go to Items"
            onCtaClick={() => router.push('/items')}
          />
        </div>
      ) : (
        <ul className={styles.grid}>
          {eligible.map((item) => {
            const firstImage = item.images?.[0] ?? item.image_url ?? null
            const isCreating = creating === item.id
            return (
              <li key={item.id} className={styles.card}>
                <button
                  type="button"
                  className={styles.cardButton}
                  onClick={() => handlePick(item.id)}
                  disabled={isCreating || creating !== null}
                  aria-busy={isCreating}
                >
                  <div className={styles.thumbWrap}>
                    {firstImage ? (
                      <Image
                        src={proxyImageUrl(firstImage)}
                        alt={item.item_name}
                        fill
                        sizes="(min-width: 600px) 50vw, 100vw"
                        className={styles.thumb}
                        loading="lazy"
                        unoptimized
                      />
                    ) : (
                      <div className={styles.thumbPlaceholder} aria-hidden="true">
                        <Tag size={24} />
                      </div>
                    )}
                  </div>
                  <div className={styles.cardBody}>
                    <span className={styles.cardName}>{item.item_name}</span>
                    {item.estimated_replace_cost !== null && item.replace_currency && (
                      <span className={styles.cardHint}>
                        Worth about {item.replace_currency} {item.estimated_replace_cost}
                      </span>
                    )}
                    {isCreating && (
                      <span className={styles.cardHint}>Creating draft…</span>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => router.push('/selling')}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
