import { NextRequest } from 'next/server'
import { getListing, markListingSold } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const existing = await getListing(id)
  if (!existing || existing.user_profile_id !== profile.id) {
    return Response.json({ ok: false, error: 'Listing not found' }, { status: 404 })
  }

  try {
    const sold = await markListingSold(id)
    return Response.json(sold)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
