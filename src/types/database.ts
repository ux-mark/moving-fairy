import type {
  BiosecurityCategory,
  BiosecurityFlag,
  BoxScanStatus,
  BoxSize,
  BoxStatus,
  BoxType,
  Country,
  EnquiryStatus,
  ItemSource,
  ListingCondition,
  ListingStatus,
  ListingVisibility,
  OnwardTimeline,
  ProcessingStatus,
  ShipmentStatus,
  Verdict,
} from '@/lib/constants'

export interface TransformerEquipment {
  owned: boolean
  model: string | null
  wattage_w: number | null
}

export interface Equipment {
  transformer?: TransformerEquipment
}

/**
 * Plant-care information attached to an item assessment. All fields are
 * optional — Aisling may emit a partial record. Populated only when
 * `biosecurity_category === 'plant_matter'`; non-plant items leave `care`
 * null on the row.
 *
 * `*_level` values are 1 / 2 / 3:
 *   light_level: 1 low, 2 medium, 3 bright
 *   water_level: 1 sparse, 2 medium, 3 frequent
 *   feed_level:  1 sparse, 2 monthly, 3 weekly
 */
export interface PlantCare {
  light?: string
  light_level?: 1 | 2 | 3
  water?: string
  water_level?: 1 | 2 | 3
  soil?: string
  /**
   * Coarse soil-type bucket — drives the soil-icon glyph in the buyer-side
   * care grid. Independent of the free-text `soil` label, which can still
   * carry a richer description (e.g. "Well-draining cactus mix").
   */
  soil_type?: 'drain' | 'standard' | 'moist' | 'specialty'
  feed?: string
  feed_level?: 1 | 2 | 3
  summary?: string
}

export interface UserProfile {
  id: string
  created_at: string
  updated_at: string
  auth_user_id: string
  departure_country: Country
  arrival_country: Country
  onward_country: Country | null
  onward_timeline: OnwardTimeline | null
  equipment: Equipment
  anthropic_api_key: string | null
}

export interface ItemAssessment {
  id: string
  user_profile_id: string
  item_name: string
  item_description: string | null
  verdict: Verdict | null          // nullable while pending/processing
  advice_text: string | null
  /** Legacy single image. Kept for back-compat; new code should prefer `images`. */
  image_url: string | null
  /** Ordered array of storage URLs. Back-filled from `image_url` in 20260516000001. */
  images: string[]
  biosecurity_flag: BiosecurityFlag | null
  biosecurity_category: BiosecurityCategory | null
  biosecurity_note: string | null
  user_confirmed_biosecurity: boolean
  voltage_compatible: boolean | null
  needs_transformer: boolean | null
  estimated_ship_cost: number | null
  currency: string | null
  estimated_replace_cost: number | null
  replace_currency: string | null
  user_confirmed: boolean
  processing_status: ProcessingStatus
  confidence: number | null
  needs_clarification: boolean
  source: ItemSource
  /**
   * Optional override of the shipment leg this item is destined for. When
   * null the item falls back to "the first shipment for the user's profile"
   * (current default for single-leg moves, leg 1 for two-leg moves).
   */
  target_shipment_id: string | null
  /**
   * Free-text category label for this item. Validated against the seller's
   * master list in `seller_settings.categories`. Null until set by Aisling
   * or the owner.
   */
  category: string | null
  /**
   * Plant-care record, populated by Aisling when this item is a plant
   * (biosecurity_category = 'plant_matter'). Null for non-plant items.
   */
  care: PlantCare | null
  created_at: string
  updated_at: string
}

export interface Box {
  id: string
  user_profile_id: string
  box_type: BoxType
  size: BoxSize | null
  cbm: number | null
  room_name: string
  box_number: number
  label: string
  manifest_image_url: string | null
  status: BoxStatus
  shipment_id: string | null
  created_at: string
  updated_at: string
}

export interface BoxItem {
  id: string
  box_id: string
  item_assessment_id: string | null
  item_name: string | null
  quantity: number
  from_handwritten_list: boolean
  needs_assessment: boolean
  created_at: string
}

export interface BoxScan {
  id: string
  box_id: string
  status: BoxScanStatus
  total_found: number
  matched_count: number
  new_count: number
  flagged_count: number
  illegible_count: number
  illegible_entries: string[]
  flagged_items: Array<{ item_assessment_id: string; verdict: string; item_name: string }>
  created_at: string
  updated_at: string
}

export interface ItemConversation {
  id: string
  item_assessment_id: string
  created_at: string
  updated_at: string
}

export interface ItemConversationMessage {
  id: string
  item_conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

export interface Listing {
  id: string
  user_profile_id: string
  item_assessment_id: string
  slug: string
  asking_price: number | null
  currency: string
  condition: ListingCondition | null
  brand: string | null
  model_name: string | null
  dimensions: string | null
  included: string | null
  details: string | null
  listing_status: ListingStatus
  visibility: ListingVisibility
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface Shipment {
  id: string
  user_profile_id: string
  leg_order: number
  label: string
  origin_country: string
  destination_country: string
  status: ShipmentStatus
  target_date: string | null
  share_token: string | null
  created_at: string
  updated_at: string
}

export interface Enquiry {
  id: string
  user_profile_id: string
  /** UUIDs of listings the buyer enquired about (bundle support). */
  listing_ids: string[]
  buyer_email: string
  buyer_name: string | null
  message: string
  subtotal_cents: number | null
  discount_percent: number | null
  total_cents: number | null
  status: EnquiryStatus
  created_at: string
}

export interface DiscountTier {
  min: number
  max: number | null
  percent: number
}

export interface SellerSettings {
  id: string
  user_profile_id: string
  currency: string
  seller_display_name: string | null
  contact_email: string | null
  pickup_location_copy: string | null
  discount_tiers: DiscountTier[]
  biosecurity_destination_preset: string | null
  default_collection_name: string
  default_condition: 'excellent' | 'like_new' | 'good' | 'fair' | null
  /**
   * Master list of listing categories available to this seller. Auto-merged
   * when Aisling proposes a new label that isn't already on the list.
   */
  categories: string[]
  created_at: string
  updated_at: string
}
