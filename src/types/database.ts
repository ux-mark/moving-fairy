import type { BoxScanStatus, BoxSize, BoxStatus, BoxType, Country, ItemSource, OnwardTimeline, ProcessingStatus, Verdict } from '@/lib/constants'

export interface TransformerEquipment {
  owned: boolean
  model: string | null
  wattage_w: number | null
}

export interface Equipment {
  transformer?: TransformerEquipment
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
  image_url: string | null
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
