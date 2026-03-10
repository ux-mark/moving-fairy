import { NextRequest } from 'next/server'
import { saveItemAssessment, getItemAssessments, findOrCreateSession } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'
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
  currency?: string
  estimated_replace_cost?: number
  replace_currency?: string
}

export async function GET(req: NextRequest) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const verdict = searchParams.get('verdict') as Verdict | null
  const assessments = await getItemAssessments(
    profile.id,
    verdict ? { verdict } : undefined
  )
  return Response.json(assessments)
}

export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  const session = await findOrCreateSession(profile.id)

  const body = await req.json() as ConfirmBody
  const record = await saveItemAssessment({
    user_profile_id: profile.id,
    session_id: session.id,
    item_name: body.item_name,
    verdict: body.verdict as Verdict,
    advice_text: body.advice_text ?? null,
    item_description: body.item_description ?? null,
    image_url: body.image_url ?? null,
    voltage_compatible: body.voltage_compatible ?? null,
    needs_transformer: body.needs_transformer ?? null,
    estimated_ship_cost: body.estimated_ship_cost ?? null,
    currency: body.currency ?? null,
    estimated_replace_cost: body.estimated_replace_cost ?? null,
    replace_currency: body.replace_currency ?? null,
  })
  return Response.json({ ok: true, assessment_id: record.id })
}
