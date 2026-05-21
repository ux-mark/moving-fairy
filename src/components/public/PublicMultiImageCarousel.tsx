'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { buyerCopy } from '@/lib/copy/buyer'
import { proxyImageUrl } from '@/lib/storage-url'
import { cn } from '@/lib/utils'
import styles from './PublicMultiImageCarousel.module.css'

type Props = {
  images: string[]
  alt: string
  /** When true, draws the "Sold" ribbon overlay. */
  sold?: boolean
}

export function PublicMultiImageCarousel({ images, alt, sold }: Props) {
  const [idx, setIdx] = useState(0)
  const total = images.length
  const trackRef = useRef<HTMLDivElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const dragStartXRef = useRef<number | null>(null)
  const dragDeltaRef = useRef(0)

  const go = useCallback(
    (next: number) => {
      if (total === 0) return
      const wrapped = ((next % total) + total) % total
      setIdx(wrapped)
    },
    [total],
  )

  // Keyboard navigation.
  useEffect(() => {
    if (total <= 1) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') go(idx - 1)
      if (e.key === 'ArrowRight') go(idx + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx, total, go])

  // Touch swipe.
  useEffect(() => {
    const el = wrapRef.current
    if (!el || total <= 1) return

    function onStart(e: TouchEvent) {
      const t = e.touches[0]
      if (!t) return
      dragStartXRef.current = t.clientX
      dragDeltaRef.current = 0
      if (trackRef.current) trackRef.current.style.transition = 'none'
    }
    function onMove(e: TouchEvent) {
      if (dragStartXRef.current === null) return
      const t = e.touches[0]
      if (!t) return
      dragDeltaRef.current = t.clientX - dragStartXRef.current
      const w = el!.clientWidth
      const pct = idx * 100 - (dragDeltaRef.current / w) * 100
      if (trackRef.current) trackRef.current.style.transform = `translateX(-${pct}%)`
    }
    function onEnd() {
      if (trackRef.current) trackRef.current.style.transition = ''
      const w = el!.clientWidth
      if (Math.abs(dragDeltaRef.current) > w * 0.18) {
        go(idx + (dragDeltaRef.current < 0 ? 1 : -1))
      } else {
        // snap back
        if (trackRef.current) trackRef.current.style.transform = `translateX(-${idx * 100}%)`
      }
      dragStartXRef.current = null
      dragDeltaRef.current = 0
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: true })
    el.addEventListener('touchend', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
  }, [idx, total, go])

  if (total === 0) {
    return <div className={cn(styles.wrap, styles.empty)} aria-hidden />
  }

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <div
        ref={trackRef}
        className={styles.track}
        style={{ transform: `translateX(-${idx * 100}%)` }}
      >
        {images.map((src, i) => (
          <div key={`${src}-${i}`} className={styles.slide}>
            {/* eslint-disable-next-line @next/next/no-img-element -- public buyer surface */}
            <img
              src={proxyImageUrl(src)}
              alt={alt}
              decoding="async"
              loading={i === 0 ? 'eager' : 'lazy'}
              draggable={false}
              className={styles.image}
            />
          </div>
        ))}
      </div>

      {sold ? <div className={styles.soldRibbon}>{buyerCopy.soldRibbon}</div> : null}

      {total > 1 ? (
        <>
          <button
            type="button"
            className={cn(styles.navBtn, styles.prev)}
            onClick={() => go(idx - 1)}
            aria-label={buyerCopy.prevPhoto}
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <button
            type="button"
            className={cn(styles.navBtn, styles.next)}
            onClick={() => go(idx + 1)}
            aria-label={buyerCopy.nextPhoto}
          >
            <ChevronRight size={18} aria-hidden />
          </button>
          <div className={styles.dots}>
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                className={cn(styles.dot, i === idx && styles.dotActive)}
                onClick={() => go(i)}
                aria-label={buyerCopy.photoIndicatorLabel(i)}
                aria-current={i === idx ? 'true' : undefined}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
