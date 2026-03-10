import { cookies } from 'next/headers'
import { createUserProfile, createSession } from '@/mcp'
import { Country, OnwardTimeline } from '@/lib/constants'
import type { Equipment } from '@/types/database'

const VALID_COUNTRIES = Object.values(Country) as string[]
const VALID_TIMELINES = Object.values(OnwardTimeline) as string[]

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const raw = body as Record<string, unknown>

  // ── Required fields ─────────────────────────────────────────────────────

  const departure_country = raw.departure_country
  const arrival_country = raw.arrival_country

  if (typeof departure_country !== 'string' || !VALID_COUNTRIES.includes(departure_country)) {
    return Response.json({ error: 'departure_country is required and must be a valid country code' }, { status: 400 })
  }

  if (typeof arrival_country !== 'string' || !VALID_COUNTRIES.includes(arrival_country)) {
    return Response.json({ error: 'arrival_country is required and must be a valid country code' }, { status: 400 })
  }

  if (departure_country === arrival_country) {
    return Response.json({ error: 'departure_country and arrival_country must be different' }, { status: 400 })
  }

  // ── Optional: onward move ────────────────────────────────────────────────

  const onward_country = raw.onward_country ?? null
  const onward_timeline = raw.onward_timeline ?? null

  if (onward_country !== null) {
    if (typeof onward_country !== 'string' || !VALID_COUNTRIES.includes(onward_country)) {
      return Response.json({ error: 'onward_country must be a valid country code' }, { status: 400 })
    }
    if (onward_country === arrival_country) {
      return Response.json({ error: 'onward_country must differ from arrival_country' }, { status: 400 })
    }
  }

  if (onward_timeline !== null) {
    if (!onward_country) {
      return Response.json({ error: 'onward_country must be set when onward_timeline is provided' }, { status: 400 })
    }
    if (typeof onward_timeline !== 'string' || !VALID_TIMELINES.includes(onward_timeline)) {
      return Response.json({ error: 'onward_timeline must be a valid timeline value' }, { status: 400 })
    }
  }

  // ── Optional: equipment ──────────────────────────────────────────────────

  // Accept either a pre-built equipment object (from OnboardingWizard) or
  // individual transformer fields (from the task spec fallback format)
  let equipment: Equipment = {}

  if (raw.equipment !== undefined && raw.equipment !== null) {
    equipment = raw.equipment as Equipment
  } else if (raw.has_transformer !== undefined) {
    const owned = Boolean(raw.has_transformer)
    const model = typeof raw.transformer_model === 'string' ? raw.transformer_model : null
    const wattage_w =
      typeof raw.transformer_wattage === 'number' && !Number.isNaN(raw.transformer_wattage)
        ? raw.transformer_wattage
        : null
    equipment = { transformer: { owned, model, wattage_w } }
  }

  // ── Optional: Anthropic API key ──────────────────────────────────────────

  const anthropic_api_key =
    typeof raw.anthropic_api_key === 'string' && raw.anthropic_api_key.trim().length > 0
      ? raw.anthropic_api_key.trim()
      : null

  // ── Create profile + session ─────────────────────────────────────────────

  try {
    const profile = await createUserProfile({
      departure_country: departure_country as Country,
      arrival_country: arrival_country as Country,
      ...(onward_country !== null && { onward_country: onward_country as Country }),
      ...(onward_timeline !== null && { onward_timeline: onward_timeline as OnwardTimeline }),
      equipment,
      anthropic_api_key,
    })

    const session = await createSession(profile.id)

    // Set session cookie — HttpOnly, SameSite=Lax, Path=/, 30-day max-age
    const cookieStore = await cookies()
    cookieStore.set('session_id', session.id, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days in seconds
      secure: process.env.NODE_ENV === 'production',
    })

    return Response.json({ ok: true, session_id: session.id }, { status: 201 })
  } catch (err) {
    console.error('[onboarding] failed to create profile/session:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to set up your profile' },
      { status: 500 }
    )
  }
}
