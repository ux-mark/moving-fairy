export const Country = {
  US: 'US',
  IE: 'IE',
  AU: 'AU',
  CA: 'CA',
  UK: 'UK',
  NZ: 'NZ',
} as const
export type Country = (typeof Country)[keyof typeof Country]

export const OnwardTimeline = {
  ONE_TWO_YEARS: '1_2yr',
  THREE_FIVE_YEARS: '3_5yr',
  FIVE_PLUS_YEARS: '5yr_plus',
  UNDECIDED: 'undecided',
} as const
export type OnwardTimeline = (typeof OnwardTimeline)[keyof typeof OnwardTimeline]

export const Verdict = {
  SELL: 'SELL',
  DONATE: 'DONATE',
  DISCARD: 'DISCARD',
  SHIP: 'SHIP',
  CARRY: 'CARRY',
  REVISIT: 'REVISIT',
} as const
export type Verdict = (typeof Verdict)[keyof typeof Verdict]

export const ProcessingStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const
export type ProcessingStatus = (typeof ProcessingStatus)[keyof typeof ProcessingStatus]

export const ItemSource = {
  PHOTO_UPLOAD: 'photo_upload',
  TEXT_ADD: 'text_add',
  STICKER_SCAN: 'sticker_scan',
  MANUAL: 'manual',
} as const
export type ItemSource = (typeof ItemSource)[keyof typeof ItemSource]

export const BoxSize = {
  XS: 'XS',
  S: 'S',
  M: 'M',
  L: 'L',
} as const
export type BoxSize = (typeof BoxSize)[keyof typeof BoxSize]

export const BoxType = {
  STANDARD: 'standard',
  CHECKED_LUGGAGE: 'checked_luggage',
  CARRYON: 'carryon',
  SINGLE_ITEM: 'single_item',
} as const
export type BoxType = (typeof BoxType)[keyof typeof BoxType]

export const BoxStatus = {
  PACKING: 'packing',
  PACKED: 'packed',
  SHIPPED: 'shipped',
  ARRIVED: 'arrived',
} as const
export type BoxStatus = (typeof BoxStatus)[keyof typeof BoxStatus]

/** Map country code → default currency code */
export const COUNTRY_CURRENCY: Record<string, string> = {
  US: 'USD',
  IE: 'EUR',
  AU: 'AUD',
  CA: 'CAD',
  UK: 'GBP',
  NZ: 'NZD',
}

export const BoxScanStatus = {
  PROCESSING: 'processing',
  COMPLETE: 'complete',
  FAILED: 'failed',
} as const
export type BoxScanStatus = (typeof BoxScanStatus)[keyof typeof BoxScanStatus]

export const ListingStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  RESERVED: 'reserved',
  SOLD: 'sold',
} as const
export type ListingStatus = (typeof ListingStatus)[keyof typeof ListingStatus]

export const ListingVisibility = {
  UNLISTED: 'unlisted',
  PUBLIC: 'public',
  ARCHIVED: 'archived',
} as const
export type ListingVisibility = (typeof ListingVisibility)[keyof typeof ListingVisibility]

export const ListingCondition = {
  EXCELLENT: 'excellent',
  LIKE_NEW: 'like_new',
  GOOD: 'good',
  FAIR: 'fair',
} as const
export type ListingCondition = (typeof ListingCondition)[keyof typeof ListingCondition]

export const ShipmentStatus = {
  PLANNED: 'planned',
  IN_TRANSIT: 'in_transit',
  ARRIVED: 'arrived',
  CANCELLED: 'cancelled',
} as const
export type ShipmentStatus = (typeof ShipmentStatus)[keyof typeof ShipmentStatus]

export const BiosecurityFlag = {
  NONE: 'none',
  DECLARE: 'declare',
  HIGH_RISK: 'high_risk',
  PROHIBITED: 'prohibited',
} as const
export type BiosecurityFlag = (typeof BiosecurityFlag)[keyof typeof BiosecurityFlag]

export const BiosecurityCategory = {
  WOOD: 'wood',
  PLANT_MATTER: 'plant_matter',
  SOIL: 'soil',
  LEATHER: 'leather',
  FOOD: 'food',
  OTHER: 'other',
} as const
export type BiosecurityCategory = (typeof BiosecurityCategory)[keyof typeof BiosecurityCategory]

export const EnquiryStatus = {
  NEW: 'new',
  REPLIED: 'replied',
  CLOSED: 'closed',
} as const
export type EnquiryStatus = (typeof EnquiryStatus)[keyof typeof EnquiryStatus]

/**
 * Two-initial prefix for warehouse box labels, e.g. the `WH` in `WH01-K`.
 * Single-tenant for now — change here (and keep `mf_box_label_prefix()` in the
 * box-label migration in sync) if a different owner needs different initials.
 * Could later move to a per-user setting.
 */
export const BOX_LABEL_PREFIX = 'WH'

/**
 * Map normalized (lowercased) common room names → a single uppercase letter
 * used as the suffix in box labels (e.g. Kitchen → K → `WH01-K`). Rooms that
 * share a letter (Kitchen/Kids → K) is fine — the number is globally unique.
 */
export const ROOM_CODES: Record<string, string> = {
  kitchen: 'K',
  bedroom: 'B',
  bathroom: 'A',
  'living room': 'L',
  lounge: 'L',
  garage: 'G',
  office: 'O',
  dining: 'D',
  kids: 'C',
  children: 'C',
  hall: 'H',
  hallway: 'H',
  garden: 'Y',
  outdoor: 'Y',
  store: 'S',
  storage: 'S',
  master: 'M',
}

/**
 * Resolve a room name to its single-letter box code. Looks up the normalized
 * name in ROOM_CODES, else falls back to the first A–Z letter of the name
 * (uppercased), else 'X'.
 */
export function roomCode(roomName: string): string {
  const normalized = roomName.trim().toLowerCase()
  const mapped = ROOM_CODES[normalized]
  if (mapped) return mapped
  const firstLetter = roomName.toUpperCase().match(/[A-Z]/)
  return firstLetter ? firstLetter[0] : 'X'
}

/**
 * The "family" of a room — its first whitespace-delimited word, trimmed and
 * lowercased. Box codes group by family so name variants of the same room share
 * one code: "Bedroom 1"/"Bedroom 2" → "bedroom", "Kitchen WH19" → "kitchen",
 * "Camping & Kitchen" → "camping". Empty string if the name has no words.
 */
export function roomFamily(roomName: string): string {
  return roomName.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u'])

/**
 * Resolve a room name to a code unique among `usedCodes`. Starts from the base
 * single-letter `roomCode`; if that's taken, extends it:
 *   1. base + the next CONSONANT of the name (lowercased), e.g. Books → Bk
 *   2. else base + the next letter of the name (lowercased)
 *   3. else base + a digit (2–9)
 * Never returns a code already in `usedCodes`. Keep in sync with
 * mf_unique_room_code() in the box-room-code migration.
 */
export function uniqueRoomCode(roomName: string, usedCodes: Set<string>): string {
  const base = roomCode(roomName)
  if (!usedCodes.has(base)) return base

  const baseLower = base.toLowerCase()
  const letters = roomName.toLowerCase().replace(/[^a-z]/g, '')

  // 2. base + next consonant of the name.
  for (let i = 0; i < letters.length; i++) {
    const ch = letters[i]!
    if (i === 0 && ch === baseLower) continue
    if (!VOWELS.has(ch)) {
      const candidate = base + ch
      if (!usedCodes.has(candidate)) return candidate
    }
  }

  // 3. base + next letter of the name (any letter).
  for (let i = 0; i < letters.length; i++) {
    const ch = letters[i]!
    if (i === 0 && ch === baseLower) continue
    const candidate = base + ch
    if (!usedCodes.has(candidate)) return candidate
  }

  // 4. base + a digit.
  for (let d = 2; d <= 9; d++) {
    const candidate = base + String(d)
    if (!usedCodes.has(candidate)) return candidate
  }

  // Last resort for degenerate names: append the base until unique.
  let candidate = base
  do {
    candidate = candidate + baseLower
  } while (usedCodes.has(candidate))
  return candidate
}

export const BOX_SIZE_CBM: Record<BoxSize, number> = {
  XS: 0.04,
  S: 0.07,
  M: 0.15,
  L: 0.25,
}

/** Standard box dimensions in centimetres (L x W x H) */
export const BOX_SIZE_DIMENSIONS: Record<BoxSize, { length: number; width: number; height: number }> = {
  XS: { length: 30, width: 25, height: 20 },
  S: { length: 40, width: 30, height: 25 },
  M: { length: 50, width: 40, height: 30 },
  L: { length: 60, width: 50, height: 35 },
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

/**
 * Build a box label: `<PREFIX><NN>-<suffix>`, e.g. `WH01-K`. The number is a
 * per-user global sequence (never reused); the suffix is the room-code letter
 * (or L/C for luggage/carry-on). Single-item boxes keep their descriptive item
 * label — they still carry a global box_number for uniqueness, but it isn't
 * shown. Pure + client-safe — keep in sync with the box-label migration's SQL.
 */
export function computeBoxLabel(
  boxType: BoxType,
  roomName: string,
  boxNumber: number,
  itemLabel?: string,
  code?: string
): string {
  const n = pad2(boxNumber)
  switch (boxType) {
    case BoxType.STANDARD:
      return `${BOX_LABEL_PREFIX}${n}-${code ?? roomCode(roomName)}`
    case BoxType.CHECKED_LUGGAGE:
      return `${BOX_LABEL_PREFIX}${n}-L`
    case BoxType.CARRYON:
      return `${BOX_LABEL_PREFIX}${n}-C`
    case BoxType.SINGLE_ITEM:
      return itemLabel ?? roomName
  }
}
