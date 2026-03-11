import { NextRequest } from 'next/server'
import { updateItemAssessment } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'
import { Verdict } from '@/lib/constants'

interface PatchAssessmentBody {
  item_name?: string
  verdict?: string
  notes?: string
  estimated_value?: number
  box_id?: string
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  const { id } = await params
  const body = (await req.json()) as PatchAssessmentBody

  try {
    const changes: Parameters<typeof updateItemAssessment>[1] = {}

    if (body.item_name !== undefined) changes.item_name = body.item_name
    if (body.verdict !== undefined) changes.verdict = body.verdict as Verdict

    if (Object.keys(changes).length === 0) {
      return Response.json({ ok: false, error: 'Nothing to update' }, { status: 400 })
    }

    const assessment = await updateItemAssessment(id, changes, profile.id)
    return Response.json(assessment)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
