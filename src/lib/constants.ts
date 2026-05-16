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
