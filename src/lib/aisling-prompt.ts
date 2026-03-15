/**
 * Aisling prompt composer — background item assessment mode.
 *
 * Reads Aisling's persona and knowledge modules once at module load (they are
 * static files committed to the repo and do not change at runtime). Composes a
 * fully assembled system prompt at call time, injecting the user profile and
 * selecting the relevant country modules for the user's route.
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import type { UserProfile } from '@/types/database'

// ─── Static file cache (loaded once at module init) ──────────────────────────

const KNOWLEDGE_DIR = join(process.cwd(), 'knowledge')
const AGENTS_DIR = join(process.cwd(), '.claude', 'agents')

function readKnowledge(relativePath: string): string {
  return readFileSync(join(KNOWLEDGE_DIR, relativePath), 'utf-8')
}

// Cache the persona — it's static at runtime
const AISLING_PERSONA_RAW = readFileSync(join(AGENTS_DIR, 'aisling.md'), 'utf-8')

// Strip the YAML front-matter and the sections that are irrelevant in
// background assessment mode (MCP Tools, Session Start).
function stripPersonaSections(raw: string): string {
  // Remove YAML front-matter block (--- ... ---)
  let text = raw.replace(/^---[\s\S]*?---\n/, '')

  // Remove "## MCP Tools" section through the next top-level heading
  text = text.replace(/## MCP Tools[\s\S]*?(?=\n## )/g, '')

  // Remove "## Session Start" section through the next top-level heading
  text = text.replace(/## Session Start[\s\S]*?(?=\n## )/g, '')

  return text.trim()
}

const AISLING_PERSONA = stripPersonaSections(AISLING_PERSONA_RAW)

// Cache all knowledge modules
const VOLTAGE = readKnowledge('voltage.md')
const SHIPPING_ECON = readKnowledge('shipping-economics.md')

const COUNTRY_MODULES: Record<string, string> = {
  'US-departure': readKnowledge('countries/us-departure.md'),
  'IE-arrival': readKnowledge('countries/ie-arrival.md'),
  'AU-arrival': readKnowledge('countries/au-arrival.md'),
}

// ─── Focused instruction for single-item background assessment ───────────────

const BACKGROUND_ASSESSMENT_INSTRUCTION = `
---

## Background Assessment Mode

You are assessing a single item in background mode. The user has uploaded this item via photo or text description. There is no live conversation.

Your job: assess the item and call \`render_assessment_card\` with your verdict.

Rules:
- Do NOT call any other tools.
- Do NOT ask clarifying questions — make your best assessment from the available information.
- If you are uncertain about a key detail, set your confidence score below 60 and explain exactly what you need in the rationale field.
- Store your confidence score (0–100) based on how certain you are about all factors (voltage, cost, restrictions).
- You MUST call render_assessment_card for the item — one call, containing all fields you can determine.

---
`.trim()

// ─── Prompt composer ─────────────────────────────────────────────────────────

/**
 * Compose a fully assembled system prompt for Aisling in background assessment mode.
 *
 * Includes:
 * - Aisling's persona (MCP tools and Session Start sections stripped)
 * - Serialised user profile
 * - Relevant country modules based on the user's route
 * - Voltage and shipping economics knowledge
 * - Focused background-mode instruction
 */
export function composeAssessmentPrompt(profile: UserProfile): string {
  const sections: string[] = []

  // 1. Aisling persona (persona sections only)
  sections.push(AISLING_PERSONA)

  // 2. User profile context
  sections.push(composeProfileSection(profile))

  // 3. Country modules for the user's route
  const departureKey = `${profile.departure_country}-departure`
  if (COUNTRY_MODULES[departureKey]) {
    sections.push(`---\n\n## Departure Country: ${profile.departure_country}\n\n${COUNTRY_MODULES[departureKey]}`)
  }

  const arrivalKey = `${profile.arrival_country}-arrival`
  if (COUNTRY_MODULES[arrivalKey]) {
    sections.push(`---\n\n## Arrival Country: ${profile.arrival_country}\n\n${COUNTRY_MODULES[arrivalKey]}`)
  }

  if (profile.onward_country) {
    const onwardKey = `${profile.onward_country}-arrival`
    if (COUNTRY_MODULES[onwardKey]) {
      sections.push(`---\n\n## Onward Country: ${profile.onward_country}\n\n${COUNTRY_MODULES[onwardKey]}`)
    }
  }

  // 4. Skill modules
  sections.push(`---\n\n## Voltage Reference\n\n${VOLTAGE}`)
  sections.push(`---\n\n## Shipping Economics\n\n${SHIPPING_ECON}`)

  // 5. Background assessment instruction (last — highest priority)
  sections.push(BACKGROUND_ASSESSMENT_INSTRUCTION)

  return sections.join('\n\n')
}

// ─── Profile serialisation ────────────────────────────────────────────────────

function composeProfileSection(profile: UserProfile): string {
  const lines: string[] = [
    '---',
    '',
    '## User Profile',
    '',
    `- **Departure country**: ${profile.departure_country}`,
    `- **Arrival country**: ${profile.arrival_country}`,
  ]

  if (profile.onward_country) {
    lines.push(`- **Onward country**: ${profile.onward_country}`)
  }
  if (profile.onward_timeline) {
    lines.push(`- **Onward timeline**: ${profile.onward_timeline}`)
  }

  const transformer = profile.equipment?.transformer
  if (transformer?.owned) {
    lines.push(`- **Transformer**: owned`)
    if (transformer.model) lines.push(`  - Model: ${transformer.model}`)
    if (transformer.wattage_w) lines.push(`  - Wattage: ${transformer.wattage_w}W`)
  } else {
    lines.push(`- **Transformer**: not owned`)
  }

  // Currency context
  const currencyMap: Record<string, string> = {
    US: 'USD', IE: 'EUR', AU: 'AUD', CA: 'CAD', UK: 'GBP', NZ: 'NZD',
  }
  const currency = currencyMap[profile.departure_country] ?? 'USD'
  lines.push(`- **Display currency**: ${currency} (all monetary values in responses)`)

  lines.push('')

  return lines.join('\n')
}
