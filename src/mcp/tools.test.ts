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
import { saveItemAssessment, computeBoxLabel, getCostSummary, addItemToBox, setBoxBiosecurity } from './tools'

// ─── Shared setup helper ─────────────────────────────────────────────────────

function setupInsertChain() {
  // saveItemAssessment does a single INSERT chain: insert().select().single()
  // The dedup SELECT has been removed (item-centric model creates distinct records).
  //
  // Caller sets up the resolved value via the returned `single` mock.
  const insertSingle = vi.fn()
  const insertSelect = vi.fn(() => ({ single: insertSingle }))
  const insert = vi.fn(() => ({ select: insertSelect }))

  mockFrom.mockImplementation(() => ({ insert }))

  return { insert, single: insertSingle }
}

// ─── computeBoxLabel ────────────────────────────────────────────────────────

describe('computeBoxLabel()', () => {
  it('generates "WH01-K" for a standard kitchen box number 1', () => {
    expect(computeBoxLabel(BoxType.STANDARD, 'Kitchen', 1)).toBe('WH01-K')
  })

  it('generates "WH02-B" for standard bedroom box number 2', () => {
    expect(computeBoxLabel(BoxType.STANDARD, 'Bedroom', 2)).toBe('WH02-B')
  })

  it('zero-pads the box number to two digits', () => {
    expect(computeBoxLabel(BoxType.STANDARD, 'Kitchen', 3)).toBe('WH03-K')
    expect(computeBoxLabel(BoxType.STANDARD, 'Kitchen', 12)).toBe('WH12-K')
  })

  it('falls back to the first letter for an unmapped room name', () => {
    expect(computeBoxLabel(BoxType.STANDARD, 'Pantry', 1)).toBe('WH01-P')
  })

  it('generates "WH01-L" for checked_luggage box number 1', () => {
    expect(computeBoxLabel(BoxType.CHECKED_LUGGAGE, 'Luggage', 1)).toBe('WH01-L')
  })

  it('generates "WH03-L" for checked_luggage box number 3', () => {
    expect(computeBoxLabel(BoxType.CHECKED_LUGGAGE, 'Luggage', 3)).toBe('WH03-L')
  })

  it('generates "WH99-C" for carryon box number 99', () => {
    expect(computeBoxLabel(BoxType.CARRYON, 'Carry-on', 99)).toBe('WH99-C')
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

// getCostSummary now makes two queries:
//   1. select('departure_country, arrival_country').eq('id', profileId)  — profile
//   2. select('verdict, estimated_ship_cost, estimated_replace_cost').eq('user_profile_id', id) — items
// Both chains are select().eq(), so we use mockReturnValueOnce to differentiate.

function setupCostSummaryChain(
  profileData: { departure_country: string; arrival_country: string } | null,
  assessmentRecords: { verdict: string; estimated_ship_cost: number | null; estimated_replace_cost?: number | null }[],
  assessmentError?: { message: string } | null,
) {
  // Profile query: select().eq().single()
  const profileSingle = vi.fn().mockResolvedValue({ data: profileData, error: null })
  const profileEq = vi.fn(() => ({ single: profileSingle }))
  const profileSelect = vi.fn(() => ({ eq: profileEq }))

  // Assessment query: select().eq('user_profile_id').eq('processing_status')
  // — the second .eq() resolves directly (no .single())
  const assessmentEq2 = vi.fn().mockResolvedValue({
    data: assessmentError ? null : assessmentRecords,
    error: assessmentError ?? null,
  })
  const assessmentEq1 = vi.fn(() => ({ eq: assessmentEq2 }))
  const assessmentSelect = vi.fn(() => ({ eq: assessmentEq1 }))

  mockFrom
    .mockReturnValueOnce({ select: profileSelect })
    .mockReturnValueOnce({ select: assessmentSelect })
}

describe('getCostSummary()', () => {
  it('aggregates verdict counts correctly', async () => {
    setupCostSummaryChain(
      { departure_country: 'US', arrival_country: 'IE' },
      [
        { verdict: 'SHIP', estimated_ship_cost: 100, estimated_replace_cost: null },
        { verdict: 'SHIP', estimated_ship_cost: 200, estimated_replace_cost: null },
        { verdict: 'SELL', estimated_ship_cost: null, estimated_replace_cost: null },
        { verdict: 'DONATE', estimated_ship_cost: null, estimated_replace_cost: null },
      ],
    )

    const result = await getCostSummary('user-1')

    expect(result.counts_by_verdict['SHIP']).toBe(2)
    expect(result.counts_by_verdict['SELL']).toBe(1)
    expect(result.counts_by_verdict['DONATE']).toBe(1)
  })

  it('totals ship costs and sets ship_currency from departure country', async () => {
    setupCostSummaryChain(
      { departure_country: 'US', arrival_country: 'IE' },
      [
        { verdict: 'SHIP', estimated_ship_cost: 100, estimated_replace_cost: null },
        { verdict: 'SHIP', estimated_ship_cost: 250, estimated_replace_cost: null },
      ],
    )

    const result = await getCostSummary('user-1')

    expect(result.total_estimated_ship_cost).toBe(350)
    expect(result.ship_currency).toBe('USD')
  })

  it('sets replace_currency from arrival country', async () => {
    setupCostSummaryChain(
      { departure_country: 'US', arrival_country: 'IE' },
      [
        { verdict: 'SHIP', estimated_ship_cost: 100, estimated_replace_cost: 500 },
      ],
    )

    const result = await getCostSummary('user-1')

    expect(result.replace_currency).toBe('EUR')
    expect(result.total_estimated_replace_cost).toBe(500)
  })

  it('returns zero total when no items have ship costs', async () => {
    setupCostSummaryChain(
      { departure_country: 'US', arrival_country: 'IE' },
      [
        { verdict: 'SELL', estimated_ship_cost: null, estimated_replace_cost: null },
        { verdict: 'DONATE', estimated_ship_cost: null, estimated_replace_cost: null },
      ],
    )

    const result = await getCostSummary('user-1')

    expect(result.total_estimated_ship_cost).toBe(0)
    expect(result.ship_currency).toBe('USD')
  })

  it('returns empty counts and zero total for user with no items', async () => {
    setupCostSummaryChain(
      { departure_country: 'US', arrival_country: 'IE' },
      [],
    )

    const result = await getCostSummary('user-1')

    expect(result.counts_by_verdict).toEqual({})
    expect(result.total_estimated_ship_cost).toBe(0)
  })

  it('throws when Supabase returns an error on assessment query', async () => {
    setupCostSummaryChain(
      { departure_country: 'US', arrival_country: 'IE' },
      [],
      { message: 'query failed' },
    )

    await expect(getCostSummary('user-1')).rejects.toThrow('query failed')
  })
})

// ─── addItemToBox ──────────────────────────────────────────────────────────

describe('addItemToBox()', () => {
  function setupAddItemChains(opts: {
    assessment?: { verdict: string } | null
    assessmentError?: { message: string } | null
    existing?: { id: string; box_id: string; item_assessment_id: string; item_name: string | null } | null
    deleteResult?: { error: null }
    insertResult?: { id: string; box_id: string; item_assessment_id: string; item_name: string | null } | null
    insertError?: { message: string } | null
  }) {
    // Track all from() calls to return different chain behaviour
    let fromCallIndex = 0
    mockFrom.mockImplementation((table: string) => {
      fromCallIndex++

      if (table === 'item_assessment') {
        // select().eq().single() for verdict gate
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: opts.assessment ?? null,
                error: opts.assessmentError ?? (opts.assessment ? null : { message: 'not found' }),
              }),
            }),
          }),
        }
      }

      if (table === 'box_item') {
        // Could be: select (existing check), delete, or insert
        if (fromCallIndex <= 3) {
          // First box_item call: existing check — select().eq().limit().single()
          return {
            select: () => ({
              eq: () => ({
                limit: () => ({
                  single: vi.fn().mockResolvedValue({
                    data: opts.existing ?? null,
                    error: opts.existing ? null : { code: 'PGRST116' },
                  }),
                }),
              }),
            }),
            delete: () => ({
              eq: vi.fn().mockReturnValue({
                error: null,
                ...(opts.deleteResult ?? {}),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: vi.fn().mockResolvedValue({
                  data: opts.insertResult ?? null,
                  error: opts.insertError ?? (opts.insertResult ? null : { message: 'insert failed' }),
                }),
              }),
            }),
          }
        }

        // Later box_item calls: delete or insert
        return {
          delete: () => ({
            eq: vi.fn().mockReturnValue({
              error: null,
            }),
          }),
          insert: () => ({
            select: () => ({
              single: vi.fn().mockResolvedValue({
                data: opts.insertResult ?? null,
                error: opts.insertError ?? (opts.insertResult ? null : { message: 'insert failed' }),
              }),
            }),
          }),
        }
      }

      return {}
    })
  }

  it('rejects SELL verdict items', async () => {
    setupAddItemChains({
      assessment: { verdict: 'SELL' },
    })

    await expect(
      addItemToBox('box-1', { itemAssessmentId: 'assess-1' })
    ).rejects.toThrow('Cannot add item with verdict SELL')
  })

  it('rejects REVISIT verdict items', async () => {
    setupAddItemChains({
      assessment: { verdict: 'REVISIT' },
    })

    await expect(
      addItemToBox('box-1', { itemAssessmentId: 'assess-1' })
    ).rejects.toThrow('Cannot add item with verdict REVISIT')
  })

  it('returns existing record when item is already in the same box (idempotent)', async () => {
    const existingBoxItem = {
      id: 'bi-existing',
      box_id: 'box-1',
      item_assessment_id: 'assess-1',
      item_name: null, // assessed items store null; name resolved via item_assessment
    }
    setupAddItemChains({
      assessment: { verdict: 'SHIP' },
      existing: existingBoxItem,
    })

    const result = await addItemToBox('box-1', { itemAssessmentId: 'assess-1' })
    expect(result).toEqual(existingBoxItem)
  })

  it('throws when assessment is not found', async () => {
    setupAddItemChains({
      assessment: null,
      assessmentError: { message: 'not found' },
    })

    await expect(
      addItemToBox('box-1', { itemAssessmentId: 'nonexistent' })
    ).rejects.toThrow('Item assessment not found')
  })
})

// ─── Box ownership guard ────────────────────────────────────────────────────

describe('box ownership guard', () => {
  // assertBoxOwner runs a single box.select('user_profile_id').eq('id').single()
  function setupBoxOwner(boxOwner: string | null) {
    const single = vi.fn().mockResolvedValue({
      data: boxOwner === null ? null : { user_profile_id: boxOwner },
      error: boxOwner === null ? { code: 'PGRST116' } : null,
    })
    mockFrom.mockImplementation(() => ({
      select: () => ({ eq: () => ({ single }) }),
    }))
  }

  it('throws "Box not found" when the box belongs to another user', async () => {
    setupBoxOwner('other-user')
    await expect(setBoxBiosecurity('box-1', true, 'user-1')).rejects.toThrow('Box not found')
  })

  it('throws "Box not found" when the box does not exist', async () => {
    setupBoxOwner(null)
    await expect(setBoxBiosecurity('box-1', true, 'user-1')).rejects.toThrow('Box not found')
  })

  it('proceeds to the update when the caller owns the box', async () => {
    const updateSingle = vi.fn().mockResolvedValue({
      data: { id: 'box-1', is_biosecurity: true },
      error: null,
    })
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      // First box call: ownership check. Second: the update.
      if (call === 1) {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({ data: { user_profile_id: 'user-1' }, error: null }),
            }),
          }),
        }
      }
      return {
        update: () => ({ eq: () => ({ select: () => ({ single: updateSingle }) }) }),
      }
    })

    const box = await setBoxBiosecurity('box-1', true, 'user-1')
    expect(box).toEqual({ id: 'box-1', is_biosecurity: true })
  })
})
