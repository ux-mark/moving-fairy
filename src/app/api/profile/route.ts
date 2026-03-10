import { cookies } from 'next/headers'
import { getSession, getUserProfile, updateUserProfile } from '@/mcp'
import { Country, OnwardTimeline } from '@/lib/constants'
import type { Equipment } from '@/types/database'

const VALID_COUNTRIES = Object.values(Country) as string[]
const VALID_TIMELINES = Object.values(OnwardTimeline) as string[]

type ProfileError = { error: string; status: number }
type ProfileSuccess = { profile: import('@/types/database').UserProfile; session: import('@/types/database').Session }

async function resolveProfile(): Promise<ProfileError | ProfileSuccess> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value
  if (!sessionId) return { error: 'No session', status: 401 }

  const session = await getSession(sessionId)
  if (!session) return { error: 'Session not found', status: 401 }

  const profile = await getUserProfile(sessionId)
  if (!profile) return { error: 'Profile not found', status: 404 }

  return { profile, session }
}

function isProfileError(result: ProfileError | ProfileSuccess): result is ProfileError {
  return 'error' in result
}

export async function GET() {
  const result = await resolveProfile()
  if (isProfileError(result)) {
    return Response.json({ ok: false, error: result.error }, { status: result.status })
  }

  return Response.json({ ok: true, profile: result.profile })
}

export async function PATCH(request: Request) {
  const result = await resolveProfile()
  if (isProfileError(result)) {
    return Response.json({ ok: false, error: result.error }, { status: result.status })
  }

  const { profile } = result

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
    return Response.json({ ok: true, profile })
  }

  try {
    const updated = await updateUserProfile(profile.id, changes)
    return Response.json({ ok: true, profile: updated })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to update profile' },
      { status: 500 }
    )
  }
}
