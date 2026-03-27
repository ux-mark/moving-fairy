import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { saveItemAssessment, addItemToBox } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'
import { getAnthropicApiKey, refreshAnthropicApiKey } from '@/lib/dev-api-key'
import { useCliMode, callCli } from '@/lib/claude-cli'
import { Verdict } from '@/lib/constants'

// ─── Types ─────────────────────────────────────────────────────────────────

interface LightAssessmentBody {
  item_name: string
  box_id?: string
}

interface HaikuAssessmentResult {
  verdict: 'SHIP' | 'CARRY' | 'BLOCKED'
  flags: string[]
  flag_details: Record<string, string>
  is_electrical: boolean
  needs_confirmation: boolean
}

// ─── Voltage lookup ─────────────────────────────────────────────────────────

function countryVoltage(country: string): string {
  const voltageMap: Record<string, string> = {
    US: '120V / 60Hz',
    CA: '120V / 60Hz',
    IE: '230V / 50Hz',
    UK: '230V / 50Hz',
    AU: '230V / 50Hz',
    NZ: '230V / 50Hz',
  }
  return voltageMap[country.toUpperCase()] ?? 'unknown voltage'
}

// ─── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthenticatedProfile()

  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  let body: LightAssessmentBody
  try {
    body = (await req.json()) as LightAssessmentBody
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { item_name, box_id } = body

  if (!item_name || typeof item_name !== 'string' || !item_name.trim()) {
    return Response.json({ ok: false, error: 'item_name is required' }, { status: 400 })
  }

  try {
    const cliMode = useCliMode()

    const apiKey = cliMode
      ? ''
      : getAnthropicApiKey() || profile.anthropic_api_key || ''

    if (!cliMode && !apiKey) {
      return Response.json(
        {
          ok: false,
          error: 'No Anthropic API key configured.',
        },
        { status: 402 }
      )
    }

    const departureCountry = profile.departure_country as string
    const arrivalCountry = profile.arrival_country as string
    const onwardCountry = profile.onward_country as string | null

    const departureVoltage = countryVoltage(departureCountry)
    const arrivalVoltage = countryVoltage(arrivalCountry)
    const equipment = profile.equipment as Record<string, unknown> | undefined
    const hasTransformer =
      equipment?.transformer &&
      typeof equipment.transformer === 'object' &&
      (equipment.transformer as Record<string, unknown>).owned === true

    const onwardLine = onwardCountry
      ? `Onward country: ${onwardCountry}`
      : 'No onward country.'

    const transformerLine = hasTransformer
      ? 'User owns a step-down transformer (5,500W, bi-directional).'
      : 'User does not own a transformer.'

    const systemPrompt = `You are a quick-check assistant for international moves. Given an item name and move route, perform three checks:

1. IMPORT RESTRICTIONS: Is this item prohibited or restricted for import into ${arrivalCountry}? (e.g., food items into Australia, weapons, certain electronics)
2. VOLTAGE COMPATIBILITY: If this is an electrical item, is it compatible with ${arrivalCountry} voltage? Does it need a transformer? (departure: ${departureVoltage}, arrival: ${arrivalVoltage})
3. BIOSECURITY: Does this item pose biosecurity risks for ${arrivalCountry}? (e.g., wood, plant material, animal products for Australia)

Move context:
- Departure: ${departureCountry} (${departureVoltage})
- Arrival: ${arrivalCountry} (${arrivalVoltage})
- ${onwardLine}
- ${transformerLine}

Respond with JSON only — no explanation outside the JSON object:
{
  "verdict": "SHIP" | "CARRY" | "BLOCKED",
  "flags": ["voltage_incompatible", "needs_transformer", "biosecurity_risk", "import_restricted"],
  "flag_details": { "voltage_incompatible": "This item is 120V only and requires 230V in Ireland. It needs a transformer or should be replaced." },
  "is_electrical": boolean,
  "needs_confirmation": boolean
}

Rules:
- If the item is clearly prohibited, set verdict to BLOCKED.
- If there are flags but the item can still be shipped, set verdict to SHIP and needs_confirmation to true.
- If the item is safe to ship with no concerns, set verdict to SHIP and needs_confirmation to false.
- flags array must only contain flags that actually apply. Empty array is valid.
- flag_details must have an entry for each flag in the flags array.
- For voltage_incompatible: only flag if the item is likely single-voltage (120V only) and the arrival country uses 230V.
- For needs_transformer: flag if the item could work with a transformer but the user does not have one, or note if transformer is available.`

    const model = process.env.MODEL_LIGHT_ASSESSMENT ?? 'claude-haiku-4-5-20251001'
    const userPrompt = `Assess this item for my move: ${item_name.trim()}`

    let rawText: string

    if (cliMode) {
      // ── CLI mode: use claude subprocess ──
      rawText = await callCli(userPrompt, systemPrompt, model)
    } else {
      // ── SDK mode: direct Anthropic API ──
      const callAnthropic = async (key: string) => {
        const client = key.startsWith('sk-ant-oat')
          ? new Anthropic({ authToken: key })
          : new Anthropic({ apiKey: key })

        return client.messages.create({
          model,
          max_tokens: 512,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        })
      }

      let response: Anthropic.Messages.Message
      try {
        response = await callAnthropic(apiKey)
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : ''
        const isAuthError =
          errMsg.includes('authentication_error') ||
          errMsg.includes('401') ||
          errMsg.includes('invalid x-api-key') ||
          errMsg.includes('invalid api key')

        if (isAuthError) {
          const freshKey = refreshAnthropicApiKey()
          if (freshKey && freshKey !== apiKey) {
            console.log('[light-assessment] Retrying with refreshed token...')
            response = await callAnthropic(freshKey)
          } else {
            throw err
          }
        } else {
          throw err
        }
      }

      rawText = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('')
    }

    let assessment: HaikuAssessmentResult
    try {
      // Strip markdown code fences if present
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
      const jsonText = jsonMatch?.[1] ?? rawText
      assessment = JSON.parse(jsonText.trim()) as HaikuAssessmentResult
    } catch {
      return Response.json(
        { ok: false, error: 'Failed to parse light assessment response' },
        { status: 500 }
      )
    }

    const { verdict, flags, flag_details, needs_confirmation } = assessment

    if (verdict === 'BLOCKED') {
      const reason = Object.values(flag_details ?? {}).join(' ') || 'This item cannot be shipped.'
      return Response.json({
        ok: true,
        verdict: 'BLOCKED',
        reason,
        flags,
      })
    }

    if (!needs_confirmation || flags.length === 0) {
      // Clean result — save assessment and optionally add to box
      const saved = await saveItemAssessment({
        user_profile_id: profile.id,
        item_name: item_name.trim(),
        verdict: verdict === 'CARRY' ? Verdict.CARRY : Verdict.SHIP,
        advice_text: flags.length > 0 ? Object.values(flag_details ?? {}).join(' ') : null,
        voltage_compatible: !flags.includes('voltage_incompatible'),
        needs_transformer: flags.includes('needs_transformer'),
      })

      let boxItem = null
      if (box_id) {
        boxItem = await addItemToBox(box_id, {
          itemAssessmentId: saved.id,
        })
      }

      return Response.json({
        ok: true,
        verdict,
        assessment_id: saved.id,
        assessment: saved,
        box_item: boxItem,
        flags: [],
      })
    }

    // Has flags — return warning card data without saving
    const flagLabels: Record<string, string> = {
      voltage_incompatible: 'Voltage flag',
      needs_transformer: 'Transformer required',
      biosecurity_risk: 'Biosecurity flag',
      import_restricted: 'Import restriction',
    }

    const flagMessages = flags.map((f) => ({
      flag: f,
      label: flagLabels[f] ?? f,
      detail: flag_details[f] ?? '',
    }))

    const firstFlag = flags[0]
    const warningTitle =
      flags.length === 1 && firstFlag
        ? (flagLabels[firstFlag] ?? 'Flag')
        : `${flags.length} flags for this item`

    const warningMessage = flagMessages.map((m) => m.detail).join(' ')

    return Response.json({
      ok: true,
      verdict,
      needs_confirmation: true,
      flags,
      flag_messages: flagMessages,
      warning_card: {
        title: warningTitle,
        message: warningMessage,
        item_name: item_name.trim(),
        box_id: box_id ?? null,
        actions: ['Add anyway', "Don't add"],
      },
      // Include data needed for the confirm endpoint
      confirm_payload: {
        item_name: item_name.trim(),
        verdict,
        flags,
        advice_text: flagMessages.map((m) => `${m.label}: ${m.detail}`).join(' '),
        box_id: box_id ?? null,
        voltage_compatible: !flags.includes('voltage_incompatible'),
        needs_transformer: flags.includes('needs_transformer'),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[light-assessment] error:', err)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
