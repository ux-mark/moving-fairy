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

    // The chat message the user will visibly send (triggers immediate AI response)
    const chatMessage = `[ACTION] I've confirmed ${updated.item_name} as ${updated.verdict}. Please process this and let me know what's next.`

    // Append to session history — the chat UI will also display it and stream a response
    const session = await findOrCreateSession(profile.id)
    await appendMessage(session.id, {
      id: `action-${Date.now()}`,
      role: 'user',
      content: chatMessage,
      created_at: new Date().toISOString(),
    })

    return Response.json({ ok: true, chatMessage })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[decisions/confirm-and-send] POST error:', err)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
