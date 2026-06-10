import { describe, it, expect, vi } from 'vitest'
import type { UserProfile, ItemAssessment } from '@/types/database'

vi.mock('@/mcp', () => ({
  getCostSummary: vi.fn().mockResolvedValue({
    counts_by_verdict: { SHIP: 3, SELL: 2 },
    total_estimated_ship_cost: 450,
    ship_currency: 'USD',
  }),
}))

import { composeAislingCore, composeAssessmentPrompt } from './aisling-prompt'
import { composePerItemChatPrompt } from './per-item-chat-prompt'

const profile = {
  id: 'profile-1',
  departure_country: 'US',
  arrival_country: 'IE',
  onward_country: 'AU',
  onward_timeline: '3-5yr',
  equipment: { transformer: { owned: true, model: 'DS-5500', wattage_w: 5500 } },
  anthropic_api_key: null,
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
})

describe('composePerItemChatPrompt()', () => {
  it('composes core + item context + inventory summary + chat instructions', async () => {
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
    expect(prompt).toContain('Total items assessed: 5')
    expect(prompt).toContain('## Per-Item Chat Mode')
    expect(prompt.indexOf('## This Item')).toBeGreaterThan(
      prompt.indexOf('## Shipping Economics')
    )
    expect(prompt.indexOf('## Per-Item Chat Mode')).toBeGreaterThan(
      prompt.indexOf('## Inventory Summary')
    )
  })

  it('does NOT include the background assessment instructions', async () => {
    const prompt = await composePerItemChatPrompt(profile, item)

    expect(prompt).not.toContain('## Background Assessment Mode')
    expect(prompt).not.toContain('Do NOT ask clarifying questions')
  })
})
