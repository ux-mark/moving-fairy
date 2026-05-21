/**
 * Bundle-discount calculator. Tiers describe item-count brackets that map to
 * a percentage off the subtotal. Tiers may be ordered any way — the lookup
 * matches the first tier whose `[min, max]` bracket contains `itemCount`.
 * A `max` of `null` means "no upper bound."
 */
export type DiscountTier = {
  min: number
  max: number | null
  percent: number
}

export function calculateDiscount(
  itemCount: number,
  tiers: DiscountTier[],
): { percent: number; tier: DiscountTier | null } {
  if (!tiers || tiers.length === 0) {
    return { percent: 0, tier: null }
  }

  for (const tier of tiers) {
    const min = tier.min
    const max = tier.max
    if (itemCount >= min && (max === null || itemCount <= max)) {
      return { percent: tier.percent, tier }
    }
  }

  return { percent: 0, tier: null }
}
