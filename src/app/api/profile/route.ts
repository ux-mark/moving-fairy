import { updateUserProfile } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'
import { Country, OnwardTimeline } from '@/lib/constants'
import type { Equipment } from '@/types/database'

const VALID_COUNTRIES = Object.values(Country) as string[]
const VALID_TIMELINES = Object.values(OnwardTimeline) as string[]

export async function GET() {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  // Strip sensitive fields before returning
  const { anthropic_api_key: _, ...safeProfile } = profile
  return Response.json({ ok: true, profile: safeProfile })
}

export async function PATCH(request: Request) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  // Build validated changes
  const changes: Record<string, unknown> = {}

  // Departure country
  if (body.departure_country !== undefined) {
    if (typeof body.departure_country !== 'string' || !VALID_COUNTRIES.includes(body.departure_country)) {
      return Response.json({ ok: false, error: 'departure_country must be a valid country code' }, { status: 400 })
    }
    changes.departure_country = body.departure_country
  }

  // Arrival country
  if (body.arrival_country !== undefined) {
    if (typeof body.arrival_country !== 'string' || !VALID_COUNTRIES.includes(body.arrival_country)) {
      return Response.json({ ok: false, error: 'arrival_country must be a valid country code' }, { status: 400 })
    }
    changes.arrival_country = body.arrival_country
  }

  // Cross-field validation: departure != arrival
  const effectiveDeparture = (changes.departure_country ?? profile.departure_country) as string
  const effectiveArrival = (changes.arrival_country ?? profile.arrival_country) as string
  if (effectiveDeparture === effectiveArrival) {
    return Response.json({ ok: false, error: 'Departure and arrival countries must be different' }, { status: 400 })
  }

  // Onward country
  if (body.onward_country !== undefined) {
    if (body.onward_country === null) {
      changes.onward_country = null
      changes.onward_timeline = null
    } else {
      if (typeof body.onward_country !== 'string' || !VALID_COUNTRIES.includes(body.onward_country)) {
        return Response.json({ ok: false, error: 'onward_country must be a valid country code' }, { status: 400 })
      }
      if (body.onward_country === effectiveArrival) {
        return Response.json({ ok: false, error: 'Onward country must differ from arrival country' }, { status: 400 })
      }
      changes.onward_country = body.onward_country
    }
  }

  // Onward timeline
  if (body.onward_timeline !== undefined) {
    if (body.onward_timeline === null) {
      changes.onward_timeline = null
    } else {
      if (typeof body.onward_timeline !== 'string' || !VALID_TIMELINES.includes(body.onward_timeline)) {
        return Response.json({ ok: false, error: 'onward_timeline must be a valid timeline value' }, { status: 400 })
      }
      // Ensure onward country is set
      const effectiveOnward = changes.onward_country ?? profile.onward_country
      if (!effectiveOnward) {
        return Response.json({ ok: false, error: 'Cannot set onward_timeline without an onward_country' }, { status: 400 })
      }
      changes.onward_timeline = body.onward_timeline
    }
  }

  // Equipment
  if (body.equipment !== undefined) {
    changes.equipment = body.equipment as Equipment
  }

  // Anthropic API key
  if (body.anthropic_api_key !== undefined) {
    changes.anthropic_api_key = typeof body.anthropic_api_key === 'string' && body.anthropic_api_key.trim().length > 0
      ? body.anthropic_api_key.trim()
      : null
  }

  if (Object.keys(changes).length === 0) {
    const { anthropic_api_key: _noChange, ...safeNoChange } = profile
    return Response.json({ ok: true, profile: safeNoChange })
  }

  try {
    const updated = await updateUserProfile(profile.id, changes)
    const { anthropic_api_key: _key, ...safeUpdated } = updated
    return Response.json({ ok: true, profile: safeUpdated })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to update profile' },
      { status: 500 }
    )
  }
}
