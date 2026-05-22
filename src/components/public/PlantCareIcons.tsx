'use client'

import type { ReactNode } from 'react'
import { buyerCopy } from '@/lib/copy/buyer'
import { cn } from '@/lib/utils'
import type { PlantCare } from '@/types/database'
import styles from './PlantCareIcons.module.css'

/* ---------------------------------------------------------------------------
 * Plant-care icon set — ported from sale-fairy's hand-tuned glyphs.
 *
 * Four palettes (sun / sky / soil / leaf) drive four 26x26 tinted tiles. Each
 * tile holds a level-aware SVG: light/water/feed pick by intensity (1/2/3),
 * soil picks by type (drain/standard/moist/specialty).
 *
 * Icons are decorative — `aria-hidden` is set on the wrapper. Meaning lives
 * in the adjacent text label inside each `<CareCell />`.
 * ------------------------------------------------------------------------- */

export type CarePalette = 'sun' | 'sky' | 'soil' | 'leaf'
export type CareLevel = 1 | 2 | 3
export type SoilType = NonNullable<PlantCare['soil_type']>

const SOIL_TYPES = new Set<SoilType>(['drain', 'standard', 'moist', 'specialty'])

const PALETTE_CLASS = {
  sun: styles.tileSun,
  sky: styles.tileSky,
  soil: styles.tileSoil,
  leaf: styles.tileLeaf,
} as const

// ─── Tile wrapper ────────────────────────────────────────────────────────────

type CareTileProps = {
  palette: CarePalette
  children: ReactNode
}

/**
 * Tinted 26x26 square that hosts a single care icon. Background + glyph
 * colour come from the palette; the icon inside inherits `currentColor`.
 */
export function CareTile({ palette, children }: CareTileProps) {
  return (
    <span className={cn(styles.tile, PALETTE_CLASS[palette])} aria-hidden="true">
      {children}
    </span>
  )
}

// ─── Light icons ────────────────────────────────────────────────────────────
//   1 → crescent moon (shade)
//   2 → sun with cloud (indirect)
//   3 → full sun rays (bright)

export function LightIcon({ level }: { level?: CareLevel | undefined }) {
  const lvl: CareLevel = level ?? 2
  if (lvl === 1) {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    )
  }
  if (lvl === 2) {
    return (
      <svg
        width="20"
        height="18"
        viewBox="0 0 26 22"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="2.5" />
        <path d="M8 3v1" />
        <path d="M3 8h1" />
        <path d="M4.5 4.5l0.7 0.7" />
        <path d="M11.5 4.5l-0.7 0.7" />
        <path d="M16 19a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.5 1.2" />
        <path d="M5 19h11" />
      </svg>
    )
  }
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M4.93 4.93l1.41 1.41" />
      <path d="M17.66 17.66l1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M4.93 19.07l1.41-1.41" />
      <path d="M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

// ─── Water icons ────────────────────────────────────────────────────────────
//   1 → single drop
//   2 → two drops
//   3 → three drops

export function WaterIcon({ level }: { level?: CareLevel | undefined }) {
  const lvl: CareLevel = level ?? 2
  if (lvl === 1) {
    return (
      <svg
        width="14"
        height="20"
        viewBox="0 0 16 22"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path
          d="M8 2c-3 4.5-5 7.5-5 11a5 5 0 0 0 10 0c0-3.5-2-6.5-5-11z"
          fillOpacity={0.15}
        />
      </svg>
    )
  }
  if (lvl === 2) {
    return (
      <svg
        width="22"
        height="20"
        viewBox="0 0 26 22"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path
          d="M7 2c-2.2 3.4-3.6 5.5-3.6 8a3.6 3.6 0 0 0 7.2 0c0-2.5-1.4-4.6-3.6-8z"
          fillOpacity={0.15}
        />
        <path
          d="M19 9c-2.2 3.4-3.6 5.5-3.6 8a3.6 3.6 0 0 0 7.2 0c0-2.5-1.4-4.6-3.6-8z"
          fillOpacity={0.15}
        />
      </svg>
    )
  }
  return (
    <svg
      width="26"
      height="20"
      viewBox="0 0 32 22"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d="M6 2c-1.7 2.6-2.8 4.2-2.8 6.2a2.8 2.8 0 0 0 5.6 0c0-2-1.1-3.6-2.8-6.2z"
        fillOpacity={0.15}
      />
      <path
        d="M16 8c-1.7 2.6-2.8 4.2-2.8 6.2a2.8 2.8 0 0 0 5.6 0c0-2-1.1-3.6-2.8-6.2z"
        fillOpacity={0.15}
      />
      <path
        d="M26 2c-1.7 2.6-2.8 4.2-2.8 6.2a2.8 2.8 0 0 0 5.6 0c0-2-1.1-3.6-2.8-6.2z"
        fillOpacity={0.15}
      />
    </svg>
  )
}

// ─── Soil icons ─────────────────────────────────────────────────────────────
//   drain / standard / moist / specialty — the glyph IS the type

export function SoilIcon({ type }: { type?: SoilType | undefined }) {
  const t: SoilType = type && SOIL_TYPES.has(type) ? type : 'standard'
  if (t === 'drain') {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 9h14" />
        <path d="M6 9c0 6 3 11 6 11s6-5 6-11" />
        <circle cx="9" cy="13" r="0.6" fill="currentColor" />
        <circle cx="13" cy="14.5" r="0.6" fill="currentColor" />
        <circle cx="11" cy="16.5" r="0.6" fill="currentColor" />
        <circle cx="14.5" cy="17" r="0.6" fill="currentColor" />
      </svg>
    )
  }
  if (t === 'moist') {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 9h14" />
        <path d="M6 9c0 6 3 11 6 11s6-5 6-11" />
        <path
          d="M12 12.5c-1.2 1.6-2 2.6-2 3.6a2 2 0 0 0 4 0c0-1-0.8-2-2-3.6z"
          fill="currentColor"
          fillOpacity={0.5}
        />
      </svg>
    )
  }
  if (t === 'specialty') {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 9h14" />
        <path d="M6 9c0 6 3 11 6 11s6-5 6-11" />
        <path d="M12 12c-1 0.8-1.7 1.7-1.7 3 0.8 0 1.7-0.3 2.5-1.2" />
        <path d="M12 12c1 0.8 1.7 1.7 1.7 3-0.8 0-1.7-0.3-2.5-1.2" />
        <circle cx="12" cy="12" r="0.7" fill="currentColor" />
      </svg>
    )
  }
  // standard
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 9h14" />
      <path d="M6 9c0 6 3 11 6 11s6-5 6-11" />
      <path d="M7.5 12.5c1 0.4 2 0.4 3 0s2-0.4 3 0 2 0.4 3 0" />
      <path d="M8 16c1 0.4 2 0.4 3 0s2-0.4 2.5 0" />
    </svg>
  )
}

// ─── Feed icons ─────────────────────────────────────────────────────────────
//   1 leaf → 2 leaves → 3 leaves

export function FeedIcon({ level }: { level?: CareLevel | undefined }) {
  const lvl: CareLevel = level ?? 2
  if (lvl === 1) {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 22 22"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M11 19A6 6 0 0 1 10 7C14 6 15 5.5 17 4c1 1.4 0.5 6-1.7 8.2-2.3 2.3-5.5 2.2-5.5 2.2" />
        <path d="M3 19c0-2.5 1.5-4.5 4-5.2" />
      </svg>
    )
  }
  if (lvl === 2) {
    return (
      <svg
        width="22"
        height="18"
        viewBox="0 0 28 22"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 19A4.5 4.5 0 0 1 8.2 9.5C11 9 11.7 8.5 13 7.4c0.7 1 0.4 4.4-1.2 6-1.7 1.7-4 1.7-4 1.7" />
        <path d="M19 14A4 4 0 0 1 18.3 6C21 5.5 21.7 5 22.8 4c0.7 1 0.4 4-1 5.5-1.6 1.6-3.6 1.6-3.6 1.6" />
      </svg>
    )
  }
  return (
    <svg
      width="26"
      height="18"
      viewBox="0 0 32 22"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 14A3.4 3.4 0 0 1 4.4 6C7 5.5 7.7 5.1 8.7 4c0.6 0.9 0.4 3.5-1 5-1.4 1.4-3.3 1.4-3.3 1.4" />
      <path d="M14 18A3.4 3.4 0 0 1 13.4 10C16 9.5 16.7 9.1 17.7 8c0.6 0.9 0.4 3.5-1 5-1.4 1.4-3.3 1.4-3.3 1.4" />
      <path d="M23 14A3.4 3.4 0 0 1 22.4 6C25 5.5 25.7 5.1 26.7 4c0.6 0.9 0.4 3.5-1 5-1.4 1.4-3.3 1.4-3.3 1.4" />
    </svg>
  )
}

// ─── Cell + grid ────────────────────────────────────────────────────────────

const SOIL_LABEL_FALLBACK: Record<SoilType, string> = {
  drain: 'Well-draining',
  standard: 'Standard mix',
  moist: 'Moisture-retaining',
  specialty: 'Specialty mix',
}

type CareCellProps = {
  palette: CarePalette
  label: string
  value: string
  icon: ReactNode
}

/**
 * Label-over-value cell with a tinted icon tile on the left. Designed to be
 * a child of `.grid`; truncates the value when the column is narrow.
 */
export function CareCell({ palette, label, value, icon }: CareCellProps) {
  return (
    <div className={styles.cell}>
      <CareTile palette={palette}>{icon}</CareTile>
      <span className={styles.cellText}>
        <span className={styles.cellLabel}>{label}</span>
        <span className={styles.cellValue} title={value}>
          {value}
        </span>
      </span>
    </div>
  )
}

type PlantCareGridProps = {
  care: PlantCare
  /**
   * `card`  → just the 2x2 grid (compact preview on a listing card).
   * `panel` → grid + prose summary below a hairline rule (full detail view).
   */
  variant: 'card' | 'panel'
}

/**
 * The full 2x2 care grid. Renders one cell per care field; falls back to
 * the soil-type fallback label when `care.soil` is blank but `care.soil_type`
 * is set. Returns `null` when there's nothing to show in either variant.
 */
export function PlantCareGrid({ care, variant }: PlantCareGridProps) {
  const soilLabel =
    care.soil ??
    (care.soil_type ? SOIL_LABEL_FALLBACK[care.soil_type] : undefined)

  const hasAnyCell = Boolean(care.light || care.water || soilLabel || care.feed)
  const hasSummary = Boolean(care.summary)

  if (!hasAnyCell && !hasSummary) return null

  const grid = hasAnyCell ? (
    <div className={styles.grid}>
      {care.light ? (
        <CareCell
          palette="sun"
          label={buyerCopy.careLight}
          value={care.light}
          icon={<LightIcon level={care.light_level} />}
        />
      ) : null}
      {care.water ? (
        <CareCell
          palette="sky"
          label={buyerCopy.careWater}
          value={care.water}
          icon={<WaterIcon level={care.water_level} />}
        />
      ) : null}
      {soilLabel ? (
        <CareCell
          palette="soil"
          label={buyerCopy.careSoil}
          value={soilLabel}
          icon={<SoilIcon type={care.soil_type} />}
        />
      ) : null}
      {care.feed ? (
        <CareCell
          palette="leaf"
          label={buyerCopy.careFeed}
          value={care.feed}
          icon={<FeedIcon level={care.feed_level} />}
        />
      ) : null}
    </div>
  ) : null

  if (variant === 'card') return grid

  return (
    <div className={styles.panel}>
      {grid}
      {hasSummary ? <p className={styles.panelSummary}>{care.summary}</p> : null}
    </div>
  )
}
