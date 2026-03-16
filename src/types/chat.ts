'use client'

// ---------------------------------------------------------------------------
// Shared ChatMessage type — used by usePerItemChat and MessageBubble
// ---------------------------------------------------------------------------

interface CardData {
  item: string
  verdict: string
  confidence: number
  rationale: string
  action: string
  import_note?: string
  item_description?: string
  image_url?: string
  voltage_compatible?: boolean
  needs_transformer?: boolean
  estimated_ship_cost_usd?: number
  currency?: string
  estimated_replace_cost_usd?: number
  replace_currency?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** Only present on user messages that include uploaded images */
  imageUrls?: string[]
  type: 'text' | 'card'
  card?: CardData
}
