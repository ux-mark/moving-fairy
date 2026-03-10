import type { BoxSize, BoxStatus, BoxType, Country, OnwardTimeline, Verdict } from '@/lib/constants'

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

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface Session {
  id: string
  created_at: string
  updated_at: string
  user_profile_id: string
  messages: Message[]
}

export interface ItemAssessment {
  id: string
  user_profile_id: string
  session_id: string | null
  item_name: string
  item_description: string | null
  verdict: Verdict
  advice_text: string | null
  image_url: string | null
  voltage_compatible: boolean | null
  needs_transformer: boolean | null
  estimated_ship_cost: number | null
  currency: string | null
  estimated_replace_cost: number | null
  replace_currency: string | null
  user_confirmed: boolean
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
  item_name: string
  quantity: number
  from_handwritten_list: boolean
  needs_assessment: boolean
  created_at: string
}
