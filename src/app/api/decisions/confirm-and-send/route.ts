import { NextRequest } from 'next/server'
import { updateItemAssessment, appendMessage, findOrCreateSession } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'

interface ConfirmAndSendBody {
  assessment_id: string
}

export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  let body: ConfirmAndSendBody
  try {
    body = (await req.json()) as ConfirmAndSendBody
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { assessment_id } = body
  if (!assessment_id || typeof assessment_id !== 'string') {
    return Response.json({ ok: false, error: 'assessment_id is required' }, { status: 400 })
  }

  try {
    const updated = await updateItemAssessment(assessment_id, { user_confirmed: true }, profile.id)

    // Append a system message to the session so Aisling knows about immediate processing
    const session = await findOrCreateSession(profile.id)
    await appendMessage(session.id, {
      id: `sys-${Date.now()}`,
      role: 'user',
      content: `[SYSTEM] User confirmed assessment for ${updated.item_name} and requests immediate processing.`,
      created_at: new Date().toISOString(),
    })

    return Response.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[decisions/confirm-and-send] POST error:', err)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
