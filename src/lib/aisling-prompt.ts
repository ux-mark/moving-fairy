/**
 * Aisling prompt composer — background item assessment mode.
 *
 * Reads Aisling's persona and knowledge modules once at module load (they are
 * static files committed to the repo and do not change at runtime). Composes a
 * fully assembled system prompt at call time, injecting the user profile and
 * selecting the relevant country modules for the user's route.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ProcessingStatus, Verdict } from '@/lib/constants'
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

// ─── Prompt composers ────────────────────────────────────────────────────────

/**
 * Compose Aisling's mode-independent core: persona, user profile, route
 * country modules, and skill knowledge. Mode-specific composers append
 * their own instruction suffix to this.
 */
export function composeAislingCore(profile: UserProfile): string {
  const sections: string[] = []

  // 1. Aisling persona (persona sections only)
  sections.push(AISLING_PERSONA)

  // 2. User profile context
  sections.push(composeProfileSection(profile))

  // 2b. Owner's standing guidance, when set
  if (profile.assessment_guidance?.trim()) {
    sections.push(composeGuidanceSection(profile.assessment_guidance))
  }

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

  return sections.join('\n\n')
}

/**
 * Compose a fully assembled system prompt for Aisling in background assessment mode.
 *
 * Includes:
 * - Aisling's persona (MCP tools and Session Start sections stripped)
 * - Serialised user profile (+ owner's standing guidance when set)
 * - Relevant country modules based on the user's route
 * - Voltage and shipping economics knowledge
 * - Compact inventory digest, when the caller provides one (see
 *   composeInventoryDigest — the caller fetches, this composer stays pure)
 * - Focused background-mode instruction (last — highest priority)
 */
export function composeAssessmentPrompt(
  profile: UserProfile,
  inventoryDigest?: string | null
): string {
  const sections = [composeAislingCore(profile)]
  if (inventoryDigest) sections.push(inventoryDigest)
  sections.push(BACKGROUND_ASSESSMENT_INSTRUCTION)
  return sections.join('\n\n')
}

// ─── Inventory digest ─────────────────────────────────────────────────────────

/** Minimal item shape the digest needs — satisfied by ItemAssessment. */
export interface InventoryDigestItem {
  item_name: string
  verdict: string | null
  processing_status: string
}

const DIGEST_VERDICT_ORDER: Verdict[] = [
  Verdict.SHIP,
  Verdict.SELL,
  Verdict.DONATE,
  Verdict.DISCARD,
  Verdict.CARRY,
  Verdict.REVISIT,
]

const DIGEST_CARRY_NAME_CAP = 24

/**
 * Compact inventory digest (~100–150 tokens) shared by background assessment
 * and per-item chat. Counts completed items per verdict and names the current
 * CARRY items — CARRY is the scarce resource, so it alone gets name-level
 * context. Returns null when there are no completed items yet.
 *
 * Pure: takes already-fetched items, never queries.
 */
export function composeInventoryDigest(
  items: InventoryDigestItem[],
  extraLines: string[] = []
): string | null {
  const completed = items.filter(
    (i) => i.processing_status === ProcessingStatus.COMPLETED && i.verdict
  )
  if (completed.length === 0) return null

  const counts: Record<string, number> = {}
  for (const i of completed) {
    counts[i.verdict as string] = (counts[i.verdict as string] ?? 0) + 1
  }
  const countLine = DIGEST_VERDICT_ORDER.map((v) => `${v} ${counts[v] ?? 0}`).join(' · ')

  const carryNames = completed
    .filter((i) => i.verdict === Verdict.CARRY)
    .map((i) => i.item_name)
  const shown = carryNames.slice(0, DIGEST_CARRY_NAME_CAP)
  const overflow = carryNames.length - shown.length
  const carryLine =
    carryNames.length === 0
      ? 'Nothing is assigned to CARRY yet.'
      : `Already in CARRY (hand luggage): ${shown.join(', ')}${overflow > 0 ? ` (+${overflow} more)` : ''}.`

  return [
    '---',
    '',
    '## Inventory Summary',
    '',
    `${completed.length} item${completed.length === 1 ? '' : 's'} assessed so far: ${countLine}`,
    carryLine,
    ...extraLines,
    '',
    'CARRY space is scarce — weigh every CARRY recommendation against what is already in the luggage above, and recommend CARRY only when this item genuinely belongs alongside those.',
  ].join('\n')
}

// ─── Owner's standing guidance ────────────────────────────────────────────────

function composeGuidanceSection(guidance: string): string {
  return [
    '---',
    '',
    "## Owner's Standing Guidance",
    '',
    'The owner set these standing instructions. Apply them to every assessment and recommendation:',
    '',
    guidance.trim(),
    '',
    'This guidance shapes your verdicts and preferences, but it never overrides safety, legal, or biosecurity facts — those always win.',
  ].join('\n')
}

// ─── Profile serialisation ────────────────────────────────────────────────────

// Dual currency context — shipping costs in departure currency, replacement
// costs in arrival currency.
const CURRENCY_BY_COUNTRY: Record<string, string> = {
  US: 'USD', IE: 'EUR', AU: 'AUD', CA: 'CAD', UK: 'GBP', NZ: 'NZD',
}

export function currencyForCountry(
  country: string | null | undefined,
  fallback: string
): string {
  return (country && CURRENCY_BY_COUNTRY[country.toUpperCase()]) || fallback
}

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

  const shipCurrency = currencyForCountry(profile.departure_country, 'USD')
  const replaceCurrency = currencyForCountry(profile.arrival_country, 'EUR')
  lines.push(`- **Shipping cost currency**: ${shipCurrency} (estimated_ship_cost_usd field — costs to ship FROM ${profile.departure_country})`)
  lines.push(`- **Replacement cost currency**: ${replaceCurrency} (estimated_replace_cost_usd field — cost to replace AT ${profile.arrival_country})`)

  lines.push('')

  return lines.join('\n')
}
