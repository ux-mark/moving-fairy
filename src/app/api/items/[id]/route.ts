import { NextRequest } from 'next/server'
import { deleteItemAssessment, getItemAssessment, updateItemAssessment, appendItemEditSystemMessages } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'
import type { BiosecurityCategory, BiosecurityFlag, Verdict } from '@/lib/constants'
import { BiosecurityCategory as BiosecurityCategoryEnum, BiosecurityFlag as BiosecurityFlagEnum, ProcessingStatus } from '@/lib/constants'
import type { PlantCare } from '@/types/database'

// GET /api/items/:id
// Returns a single item by ID for the authenticated user.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params

  try {
    const item = await getItemAssessment(id, profile.id)
    if (!item) {
      return Response.json({ ok: false, error: 'Item not found' }, { status: 404 })
    }
    return Response.json(item)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}

interface PatchItemBody {
  item_name?: string
  item_description?: string | null
  verdict?: string
  advice_text?: string
  user_confirmed?: boolean
  user_confirmed_biosecurity?: boolean
  estimated_ship_cost?: number
  currency?: string
  estimated_replace_cost?: number
  replace_currency?: string
  processing_status?: ProcessingStatus
  confidence?: number
  needs_clarification?: boolean
  images?: string[]
  target_shipment_id?: string | null
  category?: string | null
  care?: PlantCare | null
  biosecurity_flag?: string | null
  biosecurity_category?: string | null
  biosecurity_note?: string | null
}

// Biosecurity note guard — free text, trimmed, capped to keep the column sane.
const BIOSECURITY_NOTE_MAX_LENGTH = 500

// Item description — free text (quantity, contents, biosecurity detail). Capped
// to keep the column and manifest sane.
const DESCRIPTION_MAX_LENGTH = 1000

// Category labels are free text — we don't gate against
// seller_settings.categories because users can freely set obsolete labels
// (see brief). We only guard the shape: non-empty string, ≤ 80 chars.
const CATEGORY_MAX_LENGTH = 80

// Plant-care guards. We accept a partial PlantCare object (every field
// optional — Aisling may emit a subset, and the owner UI may clear one
// field without touching the others). The whitelist below mirrors the
// PlantCare interface in `src/types/database.ts`.
const CARE_TEXT_MAX_LENGTH = 200
const CARE_JSON_MAX_BYTES = 2048
const CARE_TEXT_KEYS = ['light', 'water', 'soil', 'feed', 'summary'] as const
const CARE_LEVEL_KEYS = ['light_level', 'water_level', 'feed_level'] as const
const CARE_ALL_KEYS: ReadonlySet<string> = new Set<string>([
  ...CARE_TEXT_KEYS,
  ...CARE_LEVEL_KEYS,
])

function validateCare(input: unknown): { ok: true; value: PlantCare | null } | { ok: false; error: string } {
  if (input === null) return { ok: true, value: null }
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'care must be a plain object or null' }
  }
  const raw = input as Record<string, unknown>

  // Size cap on the JSON encoding to keep the JSONB column predictable.
  try {
    const encoded = JSON.stringify(raw)
    if (encoded.length > CARE_JSON_MAX_BYTES) {
      return { ok: false, error: `care exceeds ${CARE_JSON_MAX_BYTES}-byte limit` }
    }
  } catch {
    return { ok: false, error: 'care is not JSON-serialisable' }
  }

  const out: PlantCare = {}
  for (const key of Object.keys(raw)) {
    if (!CARE_ALL_KEYS.has(key)) {
      return { ok: false, error: `Unknown care field: ${key}` }
    }
  }

  for (const k of CARE_TEXT_KEYS) {
    const v = raw[k]
    if (v === undefined) continue
    if (typeof v !== 'string') {
      return { ok: false, error: `care.${k} must be a string` }
    }
    if (v.length > CARE_TEXT_MAX_LENGTH) {
      return { ok: false, error: `care.${k} must be ${CARE_TEXT_MAX_LENGTH} characters or fewer` }
    }
    if (v.length > 0) {
      out[k] = v
    }
  }

  for (const k of CARE_LEVEL_KEYS) {
    const v = raw[k]
    if (v === undefined) continue
    if (v !== 1 && v !== 2 && v !== 3) {
      return { ok: false, error: `care.${k} must be 1, 2 or 3` }
    }
    out[k] = v
  }

  // Collapse an effectively-empty record back to null so the DB column
  // stays NULL rather than `{}` — keeps "has care" checks consistent.
  return { ok: true, value: Object.keys(out).length === 0 ? null : out }
}

// PATCH /api/items/:id
// Updates an item (verdict, user_confirmed, item_name, etc.)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params

  let body: PatchItemBody
  try {
    body = await req.json() as PatchItemBody
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  try {
    const changes: Parameters<typeof updateItemAssessment>[1] = {}

    if (body.item_name !== undefined) changes.item_name = body.item_name
    if (body.item_description !== undefined) {
      if (body.item_description === null) {
        changes.item_description = null
      } else {
        if (typeof body.item_description !== 'string') {
          return Response.json({ ok: false, error: 'item_description must be a string or null' }, { status: 400 })
        }
        const trimmed = body.item_description.trim()
        if (trimmed.length > DESCRIPTION_MAX_LENGTH) {
          return Response.json(
            { ok: false, error: `item_description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer` },
            { status: 400 },
          )
        }
        changes.item_description = trimmed.length === 0 ? null : trimmed
      }
    }
    if (body.verdict !== undefined) changes.verdict = body.verdict as Verdict
    if (body.advice_text !== undefined) changes.advice_text = body.advice_text
    if (body.user_confirmed !== undefined) changes.user_confirmed = body.user_confirmed
    if (body.user_confirmed_biosecurity !== undefined) changes.user_confirmed_biosecurity = body.user_confirmed_biosecurity
    if (body.estimated_ship_cost !== undefined) changes.estimated_ship_cost = body.estimated_ship_cost
    if (body.currency !== undefined) changes.currency = body.currency
    if (body.estimated_replace_cost !== undefined) changes.estimated_replace_cost = body.estimated_replace_cost
    if (body.replace_currency !== undefined) changes.replace_currency = body.replace_currency
    if (body.processing_status !== undefined) changes.processing_status = body.processing_status
    if (body.confidence !== undefined) changes.confidence = body.confidence
    if (body.needs_clarification !== undefined) changes.needs_clarification = body.needs_clarification
    if (body.images !== undefined) {
      if (!Array.isArray(body.images) || !body.images.every((s) => typeof s === 'string')) {
        return Response.json({ ok: false, error: 'images must be an array of strings' }, { status: 400 })
      }
      changes.images = body.images
    }
    if (body.target_shipment_id !== undefined) {
      if (body.target_shipment_id !== null && typeof body.target_shipment_id !== 'string') {
        return Response.json({ ok: false, error: 'target_shipment_id must be a string or null' }, { status: 400 })
      }
      changes.target_shipment_id = body.target_shipment_id
    }
    if (body.category !== undefined) {
      if (body.category === null) {
        changes.category = null
      } else {
        if (typeof body.category !== 'string') {
          return Response.json({ ok: false, error: 'category must be a string or null' }, { status: 400 })
        }
        const trimmed = body.category.trim()
        if (trimmed.length === 0) {
          return Response.json({ ok: false, error: 'category must not be empty' }, { status: 400 })
        }
        if (trimmed.length > CATEGORY_MAX_LENGTH) {
          return Response.json(
            { ok: false, error: `category must be ${CATEGORY_MAX_LENGTH} characters or fewer` },
            { status: 400 },
          )
        }
        changes.category = trimmed
      }
    }

    if (body.care !== undefined) {
      const checked = validateCare(body.care)
      if (!checked.ok) {
        return Response.json({ ok: false, error: checked.error }, { status: 400 })
      }
      changes.care = checked.value
    }

    if (body.biosecurity_flag !== undefined) {
      if (body.biosecurity_flag === null) {
        changes.biosecurity_flag = null
      } else {
        const validFlags = Object.values(BiosecurityFlagEnum) as string[]
        if (!validFlags.includes(body.biosecurity_flag)) {
          return Response.json({ ok: false, error: 'Invalid biosecurity_flag' }, { status: 400 })
        }
        changes.biosecurity_flag = body.biosecurity_flag as BiosecurityFlag
      }
    }

    if (body.biosecurity_category !== undefined) {
      if (body.biosecurity_category === null) {
        changes.biosecurity_category = null
      } else {
        const validCategories = Object.values(BiosecurityCategoryEnum) as string[]
        if (!validCategories.includes(body.biosecurity_category)) {
          return Response.json({ ok: false, error: 'Invalid biosecurity_category' }, { status: 400 })
        }
        changes.biosecurity_category = body.biosecurity_category as BiosecurityCategory
      }
    }

    if (body.biosecurity_note !== undefined) {
      if (body.biosecurity_note === null) {
        changes.biosecurity_note = null
      } else {
        if (typeof body.biosecurity_note !== 'string') {
          return Response.json({ ok: false, error: 'biosecurity_note must be a string or null' }, { status: 400 })
        }
        const trimmed = body.biosecurity_note.trim()
        if (trimmed.length > BIOSECURITY_NOTE_MAX_LENGTH) {
          return Response.json(
            { ok: false, error: `biosecurity_note must be ${BIOSECURITY_NOTE_MAX_LENGTH} characters or fewer` },
            { status: 400 },
          )
        }
        changes.biosecurity_note = trimmed.length === 0 ? null : trimmed
      }
    }

    if (Object.keys(changes).length === 0) {
      return Response.json({ ok: false, error: 'Nothing to update' }, { status: 400 })
    }

    // Capture the current state before updating so we can diff meaningful fields
    // and inject system messages into the conversation.
    const isMeaningfulEdit =
      body.verdict !== undefined ||
      body.item_name !== undefined ||
      body.estimated_ship_cost !== undefined ||
      body.estimated_replace_cost !== undefined ||
      body.advice_text !== undefined ||
      body.biosecurity_flag !== undefined

    const before = isMeaningfulEdit
      ? await getItemAssessment(id, profile.id)
      : null

    const item = await updateItemAssessment(id, changes, profile.id)

    // Best-effort: persist system messages for any meaningful field changes.
    // This runs after the response data is ready so it doesn't block the reply.
    if (before) {
      void appendItemEditSystemMessages(id, profile.id, before, item)
    }

    return Response.json(item)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}

// DELETE /api/items/:id
// Deletes an item and all associated data.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params

  try {
    await deleteItemAssessment(id, profile.id)
    return Response.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    const status = message === 'Item assessment not found' ? 404
      : message === 'Not authorised to delete this item' ? 403
      : 500
    return Response.json({ ok: false, error: message }, { status })
  }
}
