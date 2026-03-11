import { NextRequest } from 'next/server'
import { updateItemAssessment } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'

interface ConfirmBody {
  assessment_id: string
}

export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  let body: ConfirmBody
  try {
    body = (await req.json()) as ConfirmBody
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { assessment_id } = body
  if (!assessment_id || typeof assessment_id !== 'string') {
    return Response.json({ ok: false, error: 'assessment_id is required' }, { status: 400 })
  }

  try {
    await updateItemAssessment(assessment_id, { user_confirmed: true }, profile.id)
    return Response.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[decisions/confirm] POST error:', err)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
