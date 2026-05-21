import { NextRequest } from 'next/server'
import { addCategory } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'

interface PostCategoryBody {
  name?: string
}

// Matches the validation in src/app/api/items/[id]/route.ts and
// src/app/api/settings/route.ts. Kept in sync deliberately — the three
// surfaces all touch the same master list.
const CATEGORY_MAX_LENGTH = 80

// POST /api/settings/categories
// Appends a single category to seller_settings.categories via the MCP
// helper (case-insensitive dedup is handled in addCategory). Returns the
// full updated categories array so the client can refresh without a
// second GET. Owner-scoped — profile id resolved from the authed session.
export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  let body: PostCategoryBody
  try {
    body = (await req.json()) as PostCategoryBody
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return Response.json({ ok: false, error: 'Category name is required.' }, { status: 400 })
  }
  if (name.length > CATEGORY_MAX_LENGTH) {
    return Response.json(
      { ok: false, error: `Category name must be ${CATEGORY_MAX_LENGTH} characters or fewer.` },
      { status: 400 },
    )
  }

  try {
    const settings = await addCategory(profile.id, name)
    return Response.json({ categories: settings.categories })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
