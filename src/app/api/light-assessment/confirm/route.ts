import { NextRequest } from 'next/server'
import { saveItemAssessment, addItemToBox, findOrCreateSession } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'
import { Verdict } from '@/lib/constants'

// ─── Types ─────────────────────────────────────────────────────────────────

interface ConfirmBody {
  item_name: string
  verdict: 'SHIP' | 'CARRY'
  flags: string[]
  advice_text?: string
  box_id?: string | null
  voltage_compatible?: boolean
  needs_transformer?: boolean
}

// ─── Route handler ──────────────────────────────────────────────────────────

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

  const { item_name, verdict, flags, advice_text, box_id, voltage_compatible, needs_transformer } =
    body

  if (!item_name || typeof item_name !== 'string' || !item_name.trim()) {
    return Response.json({ ok: false, error: 'item_name is required' }, { status: 400 })
  }

  if (verdict !== 'SHIP' && verdict !== 'CARRY') {
    return Response.json(
      { ok: false, error: 'verdict must be SHIP or CARRY' },
      { status: 400 }
    )
  }

  try {
    const session = await findOrCreateSession(profile.id)
    const mcpVerdict = verdict === 'CARRY' ? Verdict.CARRY : Verdict.SHIP

    const saved = await saveItemAssessment({
      user_profile_id: profile.id,
      session_id: session.id,
      item_name: item_name.trim(),
      verdict: mcpVerdict,
      advice_text: advice_text ?? (flags.length > 0 ? `Flags: ${flags.join(', ')}` : null),
      voltage_compatible: voltage_compatible ?? !flags.includes('voltage_incompatible'),
      needs_transformer: needs_transformer ?? flags.includes('needs_transformer'),
      user_confirmed: true,
    })

    let boxItem = null
    if (box_id) {
      boxItem = await addItemToBox(box_id, {
        itemAssessmentId: saved.id,
      })
    }

    return Response.json({
      ok: true,
      assessment_id: saved.id,
      verdict: mcpVerdict,
      box_item: boxItem,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[light-assessment/confirm] error:', err)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
