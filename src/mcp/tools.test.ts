import { describe, it, expect, vi } from 'vitest'
import { Verdict, BoxType } from '@/lib/constants'

// ─── Supabase mock ──────────────────────────────────────────────────────────
// We need a flexible mock that lets individual tests control the resolved values.
// The mock chain is: from().insert().select().single()  (for insert ops)
//                    from().select().eq()               (for getCostSummary — resolves directly)

const mockFrom = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

// Import after mock is in place
import { saveItemAssessment, computeBoxLabel, getCostSummary } from './tools'

// ─── Shared setup helper ─────────────────────────────────────────────────────

function setupInsertChain() {
  // insert().select().single() chain
  const single = vi.fn()
  const select = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select }))
  mockFrom.mockReturnValue({ insert })
  return { insert, single }
}

function setupSelectEqChain() {
  // select().eq() chain — for getCostSummary
  const eq = vi.fn()
  const select = vi.fn(() => ({ eq }))
  mockFrom.mockReturnValue({ select })
  return { eq }
}

// ─── computeBoxLabel ────────────────────────────────────────────────────────

describe('computeBoxLabel()', () => {
  it('generates "Kitchen 1" for a standard kitchen box number 1', () => {
    expect(computeBoxLabel(BoxType.STANDARD, 'Kitchen', 1)).toBe('Kitchen 1')
  })

  it('generates "Bedroom 2" for standard bedroom box number 2', () => {
    expect(computeBoxLabel(BoxType.STANDARD, 'Bedroom', 2)).toBe('Bedroom 2')
  })

  it('generates "Checked Luggage 1" for checked_luggage box number 1', () => {
    expect(computeBoxLabel(BoxType.CHECKED_LUGGAGE, 'Luggage', 1)).toBe('Checked Luggage 1')
  })

  it('generates "Checked Luggage 3" for checked_luggage box number 3', () => {
    expect(computeBoxLabel(BoxType.CHECKED_LUGGAGE, 'Luggage', 3)).toBe('Checked Luggage 3')
  })

  it('generates "Carry-on" for carryon box type (ignores room and number)', () => {
    expect(computeBoxLabel(BoxType.CARRYON, 'Carry-on', 99)).toBe('Carry-on')
  })

  it('single_item uses itemLabel when provided', () => {
    expect(computeBoxLabel(BoxType.SINGLE_ITEM, 'Misc', 1, 'KitchenAid Mixer')).toBe('KitchenAid Mixer')
  })

  it('single_item falls back to roomName when no itemLabel', () => {
    expect(computeBoxLabel(BoxType.SINGLE_ITEM, 'Guitar', 1)).toBe('Guitar')
  })
})

// ─── saveItemAssessment ─────────────────────────────────────────────────────

describe('saveItemAssessment()', () => {
  it('SHIP verdict — saves full record including image_url and cost fields', async () => {
    const { insert, single } = setupInsertChain()
    const fakeRecord = {
      id: 'abc-123',
      user_profile_id: 'user-1',
      session_id: 'sess-1',
      item_name: 'KitchenAid',
      item_description: 'Stand mixer',
      verdict: Verdict.SHIP,
      advice_text: 'Good to ship',
      image_url: 'https://example.com/img.jpg',
      voltage_compatible: true,
      needs_transformer: false,
      estimated_ship_cost: 150,
      currency: 'USD',
      estimated_replace_cost: 400,
      replace_currency: 'EUR',
      user_confirmed: false,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    }
    single.mockResolvedValueOnce({ data: fakeRecord, error: null })

    const result = await saveItemAssessment({
      user_profile_id: 'user-1',
      session_id: 'sess-1',
      item_name: 'KitchenAid',
      verdict: Verdict.SHIP,
      item_description: 'Stand mixer',
      image_url: 'https://example.com/img.jpg',
      voltage_compatible: true,
      needs_transformer: false,
      estimated_ship_cost: 150,
      currency: 'USD',
      estimated_replace_cost: 400,
      replace_currency: 'EUR',
    })

    expect(result).toEqual(fakeRecord)

    // Verify the payload passed to insert
    const calls = insert.mock.calls as unknown as [Record<string, unknown>][]
    const insertPayload = calls[0]?.[0] ?? {}
    expect(insertPayload.image_url).toBe('https://example.com/img.jpg')
    expect(insertPayload.estimated_ship_cost).toBe(150)
    expect(insertPayload.voltage_compatible).toBe(true)
    expect(insertPayload.item_description).toBe('Stand mixer')
  })

  it('SELL verdict — nulls out image_url and all cost/voltage fields', async () => {
    const { insert, single } = setupInsertChain()
    const fakeRecord = {
      id: 'sell-1',
      verdict: Verdict.SELL,
      item_name: 'Old TV',
      image_url: null,
      estimated_ship_cost: null,
      currency: null,
      voltage_compatible: null,
      needs_transformer: null,
      user_confirmed: false,
    }
    single.mockResolvedValueOnce({ data: fakeRecord, error: null })

    await saveItemAssessment({
      user_profile_id: 'user-1',
      item_name: 'Old TV',
      verdict: Verdict.SELL,
      image_url: 'https://example.com/tv.jpg',
      estimated_ship_cost: 200,
      currency: 'USD',
    })

    const calls = insert.mock.calls as unknown as [Record<string, unknown>][]
    const insertPayload = calls[0]?.[0] ?? {}
    expect(insertPayload.image_url).toBeNull()
    expect(insertPayload.estimated_ship_cost).toBeNull()
    expect(insertPayload.currency).toBeNull()
    expect(insertPayload.voltage_compatible).toBeNull()
    expect(insertPayload.needs_transformer).toBeNull()
    expect(insertPayload.item_description).toBeNull()
    expect(insertPayload.estimated_replace_cost).toBeNull()
    expect(insertPayload.replace_currency).toBeNull()
  })

  it('DONATE verdict — saves lightweight record (nulled image/costs)', async () => {
    const { insert, single } = setupInsertChain()
    const fakeRecord = {
      id: 'donate-1',
      verdict: Verdict.DONATE,
      item_name: 'Books',
      image_url: null,
      estimated_ship_cost: null,
    }
    single.mockResolvedValueOnce({ data: fakeRecord, error: null })

    await saveItemAssessment({
      user_profile_id: 'user-1',
      item_name: 'Books',
      verdict: Verdict.DONATE,
      image_url: 'https://example.com/books.jpg',
      estimated_ship_cost: 50,
    })

    const calls = insert.mock.calls as unknown as [Record<string, unknown>][]
    const insertPayload = calls[0]?.[0] ?? {}
    expect(insertPayload.image_url).toBeNull()
    expect(insertPayload.estimated_ship_cost).toBeNull()
  })

  it('throws when Supabase returns an error', async () => {
    const { single } = setupInsertChain()
    single.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } })

    await expect(
      saveItemAssessment({
        user_profile_id: 'user-1',
        item_name: 'Blender',
        verdict: Verdict.SHIP,
      })
    ).rejects.toThrow('DB error')
  })
})

// ─── getCostSummary ─────────────────────────────────────────────────────────

describe('getCostSummary()', () => {
  it('aggregates verdict counts correctly', async () => {
    const { eq } = setupSelectEqChain()
    const mockRecords = [
      { verdict: 'SHIP', estimated_ship_cost: 100, currency: 'USD' },
      { verdict: 'SHIP', estimated_ship_cost: 200, currency: 'USD' },
      { verdict: 'SELL', estimated_ship_cost: null, currency: null },
      { verdict: 'DONATE', estimated_ship_cost: null, currency: null },
    ]
    eq.mockResolvedValueOnce({ data: mockRecords, error: null })

    const result = await getCostSummary('user-1')

    expect(result.counts_by_verdict['SHIP']).toBe(2)
    expect(result.counts_by_verdict['SELL']).toBe(1)
    expect(result.counts_by_verdict['DONATE']).toBe(1)
  })

  it('totals ship costs correctly', async () => {
    const { eq } = setupSelectEqChain()
    const mockRecords = [
      { verdict: 'SHIP', estimated_ship_cost: 100, currency: 'USD' },
      { verdict: 'SHIP', estimated_ship_cost: 250, currency: 'USD' },
    ]
    eq.mockResolvedValueOnce({ data: mockRecords, error: null })

    const result = await getCostSummary('user-1')

    expect(result.total_estimated_ship_cost).toBe(350)
    expect(result.currency).toBe('USD')
  })

  it('returns zero total when no items have ship costs', async () => {
    const { eq } = setupSelectEqChain()
    const mockRecords = [
      { verdict: 'SELL', estimated_ship_cost: null, currency: null },
      { verdict: 'DONATE', estimated_ship_cost: null, currency: null },
    ]
    eq.mockResolvedValueOnce({ data: mockRecords, error: null })

    const result = await getCostSummary('user-1')

    expect(result.total_estimated_ship_cost).toBe(0)
    expect(result.currency).toBe('USD')
  })

  it('returns empty counts and zero total for user with no items', async () => {
    const { eq } = setupSelectEqChain()
    eq.mockResolvedValueOnce({ data: [], error: null })

    const result = await getCostSummary('user-1')

    expect(result.counts_by_verdict).toEqual({})
    expect(result.total_estimated_ship_cost).toBe(0)
  })

  it('throws when Supabase returns an error', async () => {
    const { eq } = setupSelectEqChain()
    eq.mockResolvedValueOnce({ data: null, error: { message: 'query failed' } })

    await expect(getCostSummary('user-1')).rejects.toThrow('query failed')
  })
})
