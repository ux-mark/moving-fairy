import { describe, it, expect } from 'vitest'
import { calculateDiscount, type DiscountTier } from './discount'

const DEFAULT_TIERS: DiscountTier[] = [
  { min: 3, max: 4, percent: 10 },
  { min: 5, max: 30, percent: 20 },
  { min: 31, max: null, percent: 30 },
]

describe('calculateDiscount()', () => {
  it('returns 0 percent with null tier when item count is below all tiers', () => {
    expect(calculateDiscount(1, DEFAULT_TIERS)).toEqual({ percent: 0, tier: null })
    expect(calculateDiscount(2, DEFAULT_TIERS)).toEqual({ percent: 0, tier: null })
  })

  it('matches the lower boundary of the first tier (3 items → 10%)', () => {
    const { percent, tier } = calculateDiscount(3, DEFAULT_TIERS)
    expect(percent).toBe(10)
    expect(tier).toEqual({ min: 3, max: 4, percent: 10 })
  })

  it('matches the upper boundary of the first tier (4 items → 10%)', () => {
    expect(calculateDiscount(4, DEFAULT_TIERS).percent).toBe(10)
  })

  it('moves to the middle tier at its lower boundary (5 items → 20%)', () => {
    expect(calculateDiscount(5, DEFAULT_TIERS).percent).toBe(20)
  })

  it('stays in the middle tier at its upper boundary (30 items → 20%)', () => {
    expect(calculateDiscount(30, DEFAULT_TIERS).percent).toBe(20)
  })

  it('moves to the open-ended top tier (31 items → 30%)', () => {
    expect(calculateDiscount(31, DEFAULT_TIERS).percent).toBe(30)
  })

  it('open-ended top tier matches arbitrarily large counts (10_000 → 30%)', () => {
    expect(calculateDiscount(10_000, DEFAULT_TIERS).percent).toBe(30)
  })

  it('returns 0 percent for empty tier list', () => {
    expect(calculateDiscount(5, [])).toEqual({ percent: 0, tier: null })
  })

  it('handles count of 0 cleanly (no tier matched)', () => {
    expect(calculateDiscount(0, DEFAULT_TIERS)).toEqual({ percent: 0, tier: null })
  })

  it('first matching tier wins when ranges overlap', () => {
    const tiers: DiscountTier[] = [
      { min: 1, max: 10, percent: 5 },
      { min: 5, max: 10, percent: 25 },
    ]
    expect(calculateDiscount(7, tiers).percent).toBe(5)
  })
})
