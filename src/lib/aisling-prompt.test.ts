import { describe, it, expect, vi } from 'vitest'
import type { UserProfile, ItemAssessment } from '@/types/database'

vi.mock('@/mcp', () => ({
  getItemAssessments: vi.fn().mockResolvedValue([
    // The item under discussion — must be excluded from the digest
    { id: 'item-1', item_name: 'KitchenAid stand mixer', verdict: 'SHIP', processing_status: 'completed', estimated_ship_cost: 60, estimated_replace_cost: 400 },
    { id: 'i2', item_name: 'Bookshelf', verdict: 'SHIP', processing_status: 'completed', estimated_ship_cost: 90, estimated_replace_cost: null },
    { id: 'i3', item_name: 'Desk lamp', verdict: 'SHIP', processing_status: 'completed', estimated_ship_cost: 30, estimated_replace_cost: 50 },
    { id: 'i4', item_name: 'Couch', verdict: 'SELL', processing_status: 'completed', estimated_ship_cost: null, estimated_replace_cost: null },
    { id: 'i5', item_name: 'Old TV', verdict: 'SELL', processing_status: 'completed', estimated_ship_cost: null, estimated_replace_cost: null },
    { id: 'i6', item_name: 'Passport folder', verdict: 'CARRY', processing_status: 'completed', estimated_ship_cost: null, estimated_replace_cost: null },
    { id: 'i7', item_name: 'Blender', verdict: null, processing_status: 'processing', estimated_ship_cost: null, estimated_replace_cost: null },
  ]),
}))

import {
  composeAislingCore,
  composeAssessmentPrompt,
  composeInventoryDigest,
} from './aisling-prompt'
import { composePerItemChatPrompt } from './per-item-chat-prompt'

const profile = {
  id: 'profile-1',
  departure_country: 'US',
  arrival_country: 'IE',
  onward_country: 'AU',
  onward_timeline: '3-5yr',
  equipment: { transformer: { owned: true, model: 'DS-5500', wattage_w: 5500 } },
  anthropic_api_key: null,
  assessment_guidance: null,
} as unknown as UserProfile

const item = {
  id: 'item-1',
  item_name: 'KitchenAid stand mixer',
  item_description: 'Red 5-quart Artisan mixer',
  verdict: 'SHIP',
  advice_text: 'Worth shipping.',
  confidence: 90,
  needs_clarification: false,
  voltage_compatible: false,
  needs_transformer: true,
  estimated_ship_cost: 60,
  currency: 'USD',
  estimated_replace_cost: 400,
  replace_currency: 'EUR',
  image_url: 'items/mixer.webp',
} as unknown as ItemAssessment

function digestItem(
  name: string,
  verdict: string | null,
  processing_status = 'completed'
) {
  return { item_name: name, verdict, processing_status }
}

describe('composeAislingCore()', () => {
  it('includes persona, profile, route modules and skill knowledge', () => {
    const core = composeAislingCore(profile)

    expect(core).toContain('# Aisling — The Moving Fairy')
    expect(core).toContain('## User Profile')
    expect(core).toContain('- **Departure country**: US')
    expect(core).toContain('## Departure Country: US')
    expect(core).toContain('## Arrival Country: IE')
    expect(core).toContain('## Onward Country: AU')
    expect(core).toContain('## Voltage Reference')
    expect(core).toContain('## Shipping Economics')
  })

  it('contains no mode-specific instruction and no stripped persona sections', () => {
    const core = composeAislingCore(profile)

    expect(core).not.toContain('## Background Assessment Mode')
    expect(core).not.toContain('## MCP Tools')
    expect(core).not.toContain('## Session Start')
    // Stale Phase-0 behaviour removed — item-centric model allows duplicates
    expect(core).not.toContain('## Duplicate Detection')
  })

  it('omits the standing guidance section when guidance is null or blank', () => {
    expect(composeAislingCore(profile)).not.toContain("## Owner's Standing Guidance")

    const blank = { ...profile, assessment_guidance: '   ' } as UserProfile
    expect(composeAislingCore(blank)).not.toContain("## Owner's Standing Guidance")
  })

  it('injects the standing guidance section when guidance is set', () => {
    const guided = {
      ...profile,
      assessment_guidance: 'Only recommend Carry for documents, medicines and the laptop.',
    } as UserProfile
    const core = composeAislingCore(guided)

    expect(core).toContain("## Owner's Standing Guidance")
    expect(core).toContain('Only recommend Carry for documents, medicines and the laptop.')
    // Framed as preference, never overriding safety facts
    expect(core).toContain('never overrides safety, legal, or biosecurity facts')
    // Sits with the profile context, before the country modules
    expect(core.indexOf("## Owner's Standing Guidance")).toBeGreaterThan(
      core.indexOf('## User Profile')
    )
    expect(core.indexOf("## Owner's Standing Guidance")).toBeLessThan(
      core.indexOf('## Departure Country: US')
    )
  })
})

describe('composeInventoryDigest()', () => {
  it('returns null for an empty inventory', () => {
    expect(composeInventoryDigest([])).toBeNull()
  })

  it('returns null when no items are completed with a verdict', () => {
    expect(
      composeInventoryDigest([
        digestItem('Blender', null, 'processing'),
        digestItem('Kettle', null, 'pending'),
        digestItem('Stuck thing', 'SHIP', 'failed'),
      ])
    ).toBeNull()
  })

  it('counts completed items per verdict in fixed order', () => {
    const digest = composeInventoryDigest([
      digestItem('A', 'SHIP'),
      digestItem('B', 'SHIP'),
      digestItem('C', 'SELL'),
      digestItem('D', 'REVISIT'),
      digestItem('E', null, 'processing'),
    ])

    expect(digest).toContain('## Inventory Summary')
    expect(digest).toContain(
      '4 items assessed so far: SHIP 2 · SELL 1 · DONATE 0 · DISCARD 0 · CARRY 0 · REVISIT 1'
    )
    expect(digest).toContain('Nothing is assigned to CARRY yet.')
  })

  it('names CARRY items and includes the weighing instruction', () => {
    const digest = composeInventoryDigest([
      digestItem('Passport folder', 'CARRY'),
      digestItem('Laptop', 'CARRY'),
      digestItem('Couch', 'SELL'),
    ])

    expect(digest).toContain('Already in CARRY (hand luggage): Passport folder, Laptop.')
    expect(digest).toContain('CARRY space is scarce')
    // Names only for CARRY — other verdicts stay count-level
    expect(digest).not.toContain('Couch')
  })

  it('caps CARRY names at 24 with a +N more suffix', () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      digestItem(`Carry item ${i + 1}`, 'CARRY')
    )
    const digest = composeInventoryDigest(items)

    expect(digest).toContain('Carry item 24')
    expect(digest).not.toContain('Carry item 25')
    expect(digest).toContain('(+6 more)')
  })

  it('inserts extra lines before the weighing instruction', () => {
    const digest = composeInventoryDigest(
      [digestItem('A', 'SHIP')],
      ['Estimated total shipping: USD 90']
    )

    expect(digest).toContain('Estimated total shipping: USD 90')
    expect(digest!.indexOf('Estimated total shipping')).toBeLessThan(
      digest!.indexOf('CARRY space is scarce')
    )
  })
})

describe('composeAssessmentPrompt()', () => {
  it('is the core plus the background-mode suffix, suffix last', () => {
    const core = composeAislingCore(profile)
    const prompt = composeAssessmentPrompt(profile)

    expect(prompt.startsWith(core)).toBe(true)
    expect(prompt).toContain('## Background Assessment Mode')
    expect(prompt.indexOf('## Background Assessment Mode')).toBeGreaterThan(
      prompt.indexOf('## Shipping Economics')
    )
    expect(prompt).toContain('Do NOT ask clarifying questions')
  })

  it('places the inventory digest between the core and the background suffix', () => {
    const digest = composeInventoryDigest([digestItem('Passport folder', 'CARRY')])
    const prompt = composeAssessmentPrompt(profile, digest)

    expect(prompt).toContain('## Inventory Summary')
    expect(prompt.indexOf('## Inventory Summary')).toBeGreaterThan(
      prompt.indexOf('## Shipping Economics')
    )
    expect(prompt.indexOf('## Inventory Summary')).toBeLessThan(
      prompt.indexOf('## Background Assessment Mode')
    )
  })

  it('omits the digest section when none is provided', () => {
    expect(composeAssessmentPrompt(profile)).not.toContain('## Inventory Summary')
    expect(composeAssessmentPrompt(profile, null)).not.toContain('## Inventory Summary')
  })
})

describe('composePerItemChatPrompt()', () => {
  it('composes core + item context + inventory digest + chat instructions', async () => {
    const prompt = await composePerItemChatPrompt(profile, item)

    // Core sections present
    expect(prompt).toContain('# Aisling — The Moving Fairy')
    expect(prompt).toContain('## User Profile')
    expect(prompt).toContain('## Arrival Country: IE')
    expect(prompt).toContain('## Voltage Reference')
    expect(prompt).toContain('## Shipping Economics')

    // Chat-specific sections present, in order after the core
    expect(prompt).toContain('## This Item')
    expect(prompt).toContain('- **Name**: KitchenAid stand mixer')
    expect(prompt).toContain('## Inventory Summary')
    expect(prompt).toContain('## Per-Item Chat Mode')
    expect(prompt.indexOf('## This Item')).toBeGreaterThan(
      prompt.indexOf('## Shipping Economics')
    )
    expect(prompt.indexOf('## Per-Item Chat Mode')).toBeGreaterThan(
      prompt.indexOf('## Inventory Summary')
    )
  })

  it('uses the shared digest, excluding the item under discussion', async () => {
    const prompt = await composePerItemChatPrompt(profile, item)

    // 6 completed items in the mock minus item-1 itself = 5
    expect(prompt).toContain(
      '5 items assessed so far: SHIP 2 · SELL 2 · DONATE 0 · DISCARD 0 · CARRY 1 · REVISIT 0'
    )
    expect(prompt).toContain('Already in CARRY (hand luggage): Passport folder.')
    expect(prompt).toContain('CARRY space is scarce')

    // Cost totals exclude item-1's 60 USD ship cost
    expect(prompt).toContain('Estimated total shipping: USD 120')
    expect(prompt).toContain('Estimated total replacement: EUR 50')
  })

  it('does NOT include the background assessment instructions', async () => {
    const prompt = await composePerItemChatPrompt(profile, item)

    expect(prompt).not.toContain('## Background Assessment Mode')
    expect(prompt).not.toContain('Do NOT ask clarifying questions')
  })
})
