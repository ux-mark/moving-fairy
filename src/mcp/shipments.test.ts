import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Supabase mock ──────────────────────────────────────────────────────────
// We mock the chained query builder so we can drive ensureShipmentsForProfile
// through both branches of its leg-count logic.

const mockFrom = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

import { ensureShipmentsForProfile } from './shipments'

type Row = Record<string, unknown>

/**
 * Build a tiny query-builder mock that resolves to the supplied rows when
 * awaited and supports the chained ops we use in ensureShipmentsForProfile.
 */
function buildBuilder(rows: Row[], single: Row | null = null) {
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.order = vi.fn(() => Promise.resolve({ data: rows, error: null }))
  builder.single = vi.fn(() => Promise.resolve({ data: single, error: single ? null : { message: 'not found' } }))
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: single, error: null }))
  builder.insert = vi.fn(() => Promise.resolve({ data: null, error: null }))
  return builder
}

describe('ensureShipmentsForProfile()', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('creates a single leg when the user has no onward_country', async () => {
    const insertCalls: Row[][] = []

    let call = 0
    mockFrom.mockImplementation((table: string) => {
      call++
      if (table === 'user_profile') {
        return buildBuilder([], {
          id: 'p1',
          departure_country: 'US',
          arrival_country: 'IE',
          onward_country: null,
        })
      }
      if (table === 'shipment') {
        // first shipment call: list existing — empty
        // insert call: capture
        // final shipment call: list after insert — one row
        if (call === 2) {
          const b = buildBuilder([])
          return b
        }
        const b = buildBuilder([
          { id: 's1', leg_order: 1, label: 'United States → Ireland' },
        ])
        b.insert = vi.fn((payload: Row[] | Row) => {
          insertCalls.push(Array.isArray(payload) ? payload : [payload])
          return Promise.resolve({ data: null, error: null })
        })
        return b
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    // Sequence in code: profile → shipment(list) → shipment(insert) → shipment(list)
    // The simple mock above keys off `call` count, but for clarity reset and use a fresh per-call sequence:
    mockFrom.mockReset()
    const profileBuilder = buildBuilder([], {
      id: 'p1',
      departure_country: 'US',
      arrival_country: 'IE',
      onward_country: null,
    })
    const listBuilder1 = buildBuilder([])
    const insertBuilder = buildBuilder([])
    insertBuilder.insert = vi.fn((payload: Row[] | Row) => {
      insertCalls.push(Array.isArray(payload) ? payload : [payload])
      return Promise.resolve({ data: null, error: null })
    })
    const listBuilder2 = buildBuilder([
      { id: 's1', leg_order: 1, label: 'United States → Ireland' },
    ])

    const builders = [profileBuilder, listBuilder1, insertBuilder, listBuilder2]
    let idx = 0
    mockFrom.mockImplementation(() => builders[idx++])

    const result = await ensureShipmentsForProfile('p1')

    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0]!).toHaveLength(1)
    expect(insertCalls[0]![0]!).toMatchObject({
      user_profile_id: 'p1',
      leg_order: 1,
      origin_country: 'US',
      destination_country: 'IE',
    })
    expect(result).toHaveLength(1)
  })

  it('creates two legs when the user has an onward_country', async () => {
    const insertCalls: Row[][] = []

    const profileBuilder = buildBuilder([], {
      id: 'p2',
      departure_country: 'US',
      arrival_country: 'IE',
      onward_country: 'AU',
    })
    const listBuilder1 = buildBuilder([])
    const insertBuilder = buildBuilder([])
    insertBuilder.insert = vi.fn((payload: Row[] | Row) => {
      insertCalls.push(Array.isArray(payload) ? payload : [payload])
      return Promise.resolve({ data: null, error: null })
    })
    const listBuilder2 = buildBuilder([
      { id: 's1', leg_order: 1 },
      { id: 's2', leg_order: 2 },
    ])

    const builders = [profileBuilder, listBuilder1, insertBuilder, listBuilder2]
    let idx = 0
    mockFrom.mockImplementation(() => builders[idx++])

    const result = await ensureShipmentsForProfile('p2')

    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0]!).toHaveLength(2)
    expect(insertCalls[0]![0]!).toMatchObject({ leg_order: 1, origin_country: 'US', destination_country: 'IE' })
    expect(insertCalls[0]![1]!).toMatchObject({ leg_order: 2, origin_country: 'IE', destination_country: 'AU' })
    expect(result).toHaveLength(2)
  })

  it('is idempotent — does not insert when both legs already exist', async () => {
    const insertCalls: Row[][] = []

    const profileBuilder = buildBuilder([], {
      id: 'p3',
      departure_country: 'US',
      arrival_country: 'IE',
      onward_country: 'AU',
    })
    const listBuilder1 = buildBuilder([
      { id: 's1', leg_order: 1 },
      { id: 's2', leg_order: 2 },
    ])
    const listBuilder2 = buildBuilder([
      { id: 's1', leg_order: 1 },
      { id: 's2', leg_order: 2 },
    ])

    // No insert call expected — bookend the iterator with builders that
    // would record one if it happened.
    const builders = [profileBuilder, listBuilder1, listBuilder2]
    let idx = 0
    mockFrom.mockImplementation(() => {
      const b = builders[idx++]
      if (!b) throw new Error('Unexpected extra DB call (likely a stray insert)')
      // intercept any insert at this layer too
      b.insert = vi.fn((payload: Row[] | Row) => {
        insertCalls.push(Array.isArray(payload) ? payload : [payload])
        return Promise.resolve({ data: null, error: null })
      })
      return b
    })

    const result = await ensureShipmentsForProfile('p3')

    expect(insertCalls).toHaveLength(0)
    expect(result).toHaveLength(2)
  })
})
