/**
 * Single source for the LLM tool schemas shared by the background assessment
 * runner (assess-item.ts) and the per-item chat route.
 *
 * The render_assessment_card input schema is the superset of the two copies
 * that previously lived in assess-item.ts and the chat route — the chat copy
 * had drifted behind (missing biosecurity, category and care fields). Only
 * the tool description differs per mode.
 */

import type { ToolDefinition } from '@/lib/claude-cli'
import type { PlantCare } from '@/types/database'

// ─── render_assessment_card ──────────────────────────────────────────────────

const RENDER_ASSESSMENT_CARD_SCHEMA: ToolDefinition['input_schema'] = {
  type: 'object',
  properties: {
    item: { type: 'string', description: 'Item name' },
    verdict: {
      type: 'string',
      enum: ['SHIP', 'SELL', 'DONATE', 'DISCARD', 'CARRY', 'REVISIT'],
    },
    confidence: { type: 'number', description: 'Confidence score 0–100' },
    rationale: {
      type: 'string',
      description: '1–3 sentences: voltage, cost, restrictions',
    },
    action: { type: 'string', description: 'One concrete next step' },
    import_note: {
      type: 'string',
      description:
        'Free-text customs / import restriction that affects the verdict. Omit if none. Use biosecurity_note for the specific biosec reason.',
    },
    biosecurity_flag: {
      type: 'string',
      enum: ['none', 'declare', 'high_risk', 'prohibited'],
      description:
        'Biosecurity risk level at the destination. ALWAYS consider biosecurity risk for every item. Whenever ANY risk exists (e.g. wood, plant matter, soil, leather, food), set a non-"none" flag. Omit entirely only for genuinely biosec-neutral items (e.g. glass, metal, ceramic). Do NOT emit "none" for every item.',
    },
    biosecurity_category: {
      type: 'string',
      enum: ['wood', 'plant_matter', 'soil', 'leather', 'food', 'other'],
      description:
        'Biosecurity category. Required whenever biosecurity_flag is set to anything other than "none".',
    },
    biosecurity_note: {
      type: 'string',
      description:
        'One-line reason the item is flagged (e.g. "Untreated wood with bark — must declare on arrival"). Omit when biosecurity_flag is omitted.',
    },
    item_description: {
      type: 'string',
      description:
        'A short factual description for the owner\'s inventory and shipping manifest. ' +
        'Note quantity when more than one (e.g. "6 dinner plates"), the material/contents, ' +
        'and any biosecurity-relevant detail (wood, plant matter, soil, leather, foodstuffs) ' +
        'since this feeds the customs/biosecurity declaration. One sentence, no verdict or advice.',
    },
    voltage_compatible: {
      type: 'boolean',
      description: 'Whether item works at destination voltage',
    },
    needs_transformer: {
      type: 'boolean',
      description: 'Whether item needs a voltage transformer',
    },
    estimated_ship_cost_usd: {
      type: 'number',
      description:
        'Estimated shipping cost in departure currency (SHIP/CARRY only)',
    },
    currency: {
      type: 'string',
      description: 'Currency code for estimated_ship_cost_usd (e.g. "USD")',
    },
    estimated_replace_cost_usd: {
      type: 'number',
      description:
        'Estimated replacement cost at arrival destination (SHIP/CARRY only)',
    },
    replace_currency: {
      type: 'string',
      description:
        'Currency code for estimated_replace_cost_usd (e.g. "EUR")',
    },
    category: {
      type: 'string',
      description:
        'Listing category for this item. Prefer one of the seller\'s existing categories; only propose a new short label when none of the existing options fit. Omit entirely if no category clearly applies.',
    },
    care: {
      type: 'object',
      description:
        'Plant-care record. Populate ONLY when biosecurity_category is "plant_matter"; omit for non-plant items. Partial records are fine — emit only what you are confident about.',
      properties: {
        light: { type: 'string', description: 'e.g. "Bright indirect", "Full sun", "Low – bright"' },
        light_level: { type: 'number', description: '1 (low), 2 (medium), 3 (bright)' },
        water: { type: 'string', description: 'e.g. "When dry", "Sparse", "Keep moist"' },
        water_level: { type: 'number', description: '1 (sparse), 2 (medium), 3 (frequent)' },
        soil: { type: 'string', description: 'e.g. "Standard mix", "Well-draining", "Cactus mix"' },
        soil_type: {
          type: 'string',
          enum: ['drain', 'standard', 'moist', 'specialty'],
          description:
            'Coarse soil-type bucket — picks the soil-icon glyph in the buyer-side care grid. "drain" = gritty / cactus mix; "standard" = standard potting mix; "moist" = moisture-loving; "specialty" = specialty mix (e.g. African violet).',
        },
        feed: { type: 'string', description: 'e.g. "Monthly", "Twice yearly", "Weekly in bloom"' },
        feed_level: { type: 'number', description: '1 (sparse), 2 (monthly), 3 (weekly)' },
        summary: { type: 'string', description: 'One-sentence prose covering light / water / soil / feed at a glance.' },
      },
    },
  },
  required: ['item', 'verdict', 'confidence', 'rationale', 'action'],
}

/** Background assessment mode — one card per assessed item. */
export const RENDER_ASSESSMENT_CARD_TOOL: ToolDefinition = {
  name: 'render_assessment_card',
  description:
    'Display a structured assessment card. Call this for EVERY item you assess — one call per item.',
  input_schema: RENDER_ASSESSMENT_CARD_SCHEMA,
}

/** Per-item chat mode — same schema, mode-specific description. */
export const CHAT_RENDER_ASSESSMENT_CARD_TOOL: ToolDefinition = {
  name: 'render_assessment_card',
  description:
    'Display an updated assessment card when your recommendation changes based on new information from the user.',
  input_schema: RENDER_ASSESSMENT_CARD_SCHEMA,
}

// ─── update_item_assessment (per-item chat only) ─────────────────────────────

export const UPDATE_ITEM_ASSESSMENT_TOOL: ToolDefinition = {
  name: 'update_item_assessment',
  description:
    'Persist changes to the item assessment in the database. Call this after render_assessment_card when you have updated your recommendation.',
  input_schema: {
    type: 'object',
    properties: {
      verdict: {
        type: 'string',
        enum: ['SHIP', 'SELL', 'DONATE', 'DISCARD', 'CARRY', 'REVISIT'],
      },
      advice_text: { type: 'string', description: 'Updated rationale text' },
      confidence: { type: 'number', description: 'Updated confidence score' },
      voltage_compatible: { type: 'boolean' },
      needs_transformer: { type: 'boolean' },
      estimated_ship_cost: { type: 'number' },
      currency: { type: 'string' },
      estimated_replace_cost: { type: 'number' },
      replace_currency: { type: 'string' },
    },
    required: [],
  },
}

/** Tool set for the per-item chat route. */
export const CHAT_TOOLS: ToolDefinition[] = [
  CHAT_RENDER_ASSESSMENT_CARD_TOOL,
  UPDATE_ITEM_ASSESSMENT_TOOL,
]

// ─── Tool call shape returned by the LLM ─────────────────────────────────────

export interface AssessmentCardInput {
  item: string
  verdict: string
  confidence: number
  rationale: string
  action: string
  import_note?: string
  biosecurity_flag?: string
  biosecurity_category?: string
  biosecurity_note?: string
  item_description?: string
  voltage_compatible?: boolean
  needs_transformer?: boolean
  estimated_ship_cost_usd?: number
  currency?: string
  estimated_replace_cost_usd?: number
  replace_currency?: string
  category?: string
  care?: PlantCare
}
