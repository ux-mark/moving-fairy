import { getPanelState, upsertPanelState } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'

export async function GET() {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const row = await getPanelState(profile.id)
  return Response.json({
    ok: true,
    state: row?.state ?? {},
    updated_at: row?.updated_at ?? null,
    // The client needs the profile id to filter its realtime subscription.
    profileId: profile.id,
  })
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

  const state = body.state
  if (
    typeof state !== 'object' ||
    state === null ||
    Array.isArray(state) ||
    !Array.isArray((state as { panels?: unknown }).panels) ||
    !Array.isArray((state as { tray?: unknown }).tray)
  ) {
    return Response.json(
      { ok: false, error: 'state must be an object with panels and tray arrays' },
      { status: 400 }
    )
  }

  const row = await upsertPanelState(profile.id, state as Record<string, unknown>)
  return Response.json({ ok: true, updated_at: row.updated_at })
}
