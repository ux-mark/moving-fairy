import { NextRequest } from 'next/server'
import { getSettings, updateSettings } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'
import type { DiscountTier } from '@/types/database'

export async function GET() {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }
  try {
    const settings = await getSettings(profile.id)
    return Response.json(settings)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}

interface PatchSettingsBody {
  currency?: string
  seller_display_name?: string | null
  contact_email?: string | null
  pickup_location_copy?: string | null
  discount_tiers?: DiscountTier[]
  biosecurity_destination_preset?: string | null
  default_collection_name?: string
  default_condition?: 'excellent' | 'like_new' | 'good' | 'fair' | null
  categories?: string[]
}

// Matches the constraint in src/app/api/items/[id]/route.ts so an owner can't
// hand-craft a category through one surface that the other would reject.
const CATEGORY_MAX_LENGTH = 80

const ALLOWED_CONDITIONS = ['excellent', 'like_new', 'good', 'fair'] as const

function isDiscountTier(value: unknown): value is DiscountTier {
  if (!value || typeof value !== 'object') return false
  const t = value as Record<string, unknown>
  return (
    typeof t.min === 'number' &&
    (t.max === null || typeof t.max === 'number') &&
    typeof t.percent === 'number'
  )
}

export async function PATCH(req: NextRequest) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  let body: PatchSettingsBody
  try {
    body = (await req.json()) as PatchSettingsBody
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  const changes: Parameters<typeof updateSettings>[1] = {}
  if (body.currency !== undefined) changes.currency = body.currency
  if (body.seller_display_name !== undefined) changes.seller_display_name = body.seller_display_name
  if (body.contact_email !== undefined) changes.contact_email = body.contact_email
  if (body.pickup_location_copy !== undefined) changes.pickup_location_copy = body.pickup_location_copy
  if (body.biosecurity_destination_preset !== undefined) {
    changes.biosecurity_destination_preset = body.biosecurity_destination_preset
  }
  if (body.default_collection_name !== undefined) changes.default_collection_name = body.default_collection_name
  if (body.default_condition !== undefined) {
    if (
      body.default_condition !== null &&
      !ALLOWED_CONDITIONS.includes(body.default_condition)
    ) {
      return Response.json(
        { ok: false, error: 'default_condition must be one of excellent, like_new, good, fair or null' },
        { status: 400 },
      )
    }
    changes.default_condition = body.default_condition
  }
  if (body.discount_tiers !== undefined) {
    if (!Array.isArray(body.discount_tiers) || !body.discount_tiers.every(isDiscountTier)) {
      return Response.json({ ok: false, error: 'discount_tiers must be an array of {min, max, percent}' }, { status: 400 })
    }
    changes.discount_tiers = body.discount_tiers
  }
  if (body.categories !== undefined) {
    if (!Array.isArray(body.categories) || !body.categories.every((c) => typeof c === 'string')) {
      return Response.json({ ok: false, error: 'categories must be an array of strings' }, { status: 400 })
    }
    // Normalise: trim, drop empties, dedupe case-insensitively while
    // preserving the order the client sent us.
    const seen = new Set<string>()
    const normalised: string[] = []
    for (const raw of body.categories) {
      const trimmed = raw.trim()
      if (!trimmed) continue
      if (trimmed.length > CATEGORY_MAX_LENGTH) {
        return Response.json(
          { ok: false, error: `Each category must be ${CATEGORY_MAX_LENGTH} characters or fewer` },
          { status: 400 },
        )
      }
      const key = trimmed.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      normalised.push(trimmed)
    }
    changes.categories = normalised
  }

  if (Object.keys(changes).length === 0) {
    return Response.json({ ok: false, error: 'Nothing to update' }, { status: 400 })
  }

  try {
    const settings = await updateSettings(profile.id, changes)
    return Response.json(settings)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
