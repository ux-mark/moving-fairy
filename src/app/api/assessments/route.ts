import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { getSession, saveItemAssessment } from '@/mcp'
import { Verdict } from '@/lib/constants'

interface ConfirmBody {
  item_name: string
  verdict: string
  advice_text?: string
  item_description?: string
  image_url?: string
  voltage_compatible?: boolean
  needs_transformer?: boolean
  estimated_ship_cost?: number
  estimated_replace_cost?: number
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value
  if (!sessionId) return Response.json({ ok: false, error: 'No session' }, { status: 401 })
  const session = await getSession(sessionId)
  if (!session) return Response.json({ ok: false, error: 'Session not found' }, { status: 401 })

  const body = await req.json() as ConfirmBody
  const record = await saveItemAssessment({
    user_profile_id: session.user_profile_id,
    session_id: sessionId,
    item_name: body.item_name,
    verdict: body.verdict as Verdict,
    advice_text: body.advice_text ?? null,
    item_description: body.item_description ?? null,
    image_url: body.image_url ?? null,
    voltage_compatible: body.voltage_compatible ?? null,
    needs_transformer: body.needs_transformer ?? null,
    estimated_ship_cost: body.estimated_ship_cost ?? null,
    estimated_replace_cost: body.estimated_replace_cost ?? null,
  })
  return Response.json({ ok: true, assessment_id: record.id })
}
