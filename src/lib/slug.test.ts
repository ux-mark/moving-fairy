import { describe, it, expect } from 'vitest'
import { buildSlug } from './utils'

describe('buildSlug()', () => {
  it('lowercases and hyphenates a simple name', () => {
    expect(buildSlug('KitchenAid Mixer')).toMatch(/^kitchenaid-mixer-[a-f0-9]{4}$/)
  })

  it('collapses runs of non-alphanumerics', () => {
    expect(buildSlug('IKEA  Malm!!')).toMatch(/^ikea-malm-[a-f0-9]{4}$/)
  })

  it('trims leading and trailing hyphens', () => {
    expect(buildSlug('  hello world  ')).toMatch(/^hello-world-[a-f0-9]{4}$/)
  })

  it('strips accents-as-non-alphanumeric (no special handling)', () => {
    // The current implementation drops non-ASCII characters; we encode that here
    // as the documented behaviour rather than aspirational unicode support.
    expect(buildSlug('café table')).toMatch(/^caf-table-[a-f0-9]{4}$/)
  })

  it('falls back to "item" when the input has no usable characters', () => {
    expect(buildSlug('!!!')).toMatch(/^item-[a-f0-9]{4}$/)
    expect(buildSlug('')).toMatch(/^item-[a-f0-9]{4}$/)
  })

  it('produces distinct slugs across repeated calls (suffix randomises)', () => {
    const a = buildSlug('Same Name')
    const b = buildSlug('Same Name')
    expect(a).not.toBe(b)
  })

  it('always appends a 4-char hex suffix preceded by a hyphen', () => {
    const slug = buildSlug('whatever')
    expect(slug.split('-').pop()).toMatch(/^[a-f0-9]{4}$/)
  })
})
