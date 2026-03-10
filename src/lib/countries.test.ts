import { describe, it, expect } from 'vitest'
import {
  getCountryMeta,
  getCountryName,
  getSupportedCountries,
  hasVoltageChange,
} from './countries'
import { Country } from './constants'

describe('getCountryName()', () => {
  it('returns "United States" for US', () => {
    expect(getCountryName(Country.US)).toBe('United States')
  })

  it('returns "Ireland" for IE', () => {
    expect(getCountryName(Country.IE)).toBe('Ireland')
  })

  it('returns "Australia" for AU', () => {
    expect(getCountryName(Country.AU)).toBe('Australia')
  })

  it('returns "Canada" for CA', () => {
    expect(getCountryName(Country.CA)).toBe('Canada')
  })

  it('returns "United Kingdom" for UK', () => {
    expect(getCountryName(Country.UK)).toBe('United Kingdom')
  })

  it('returns "New Zealand" for NZ', () => {
    expect(getCountryName(Country.NZ)).toBe('New Zealand')
  })
})

describe('getCountryMeta()', () => {
  it('returns correct voltage for US (120V)', () => {
    expect(getCountryMeta(Country.US).voltage).toBe(120)
  })

  it('returns correct voltage for IE (230V)', () => {
    expect(getCountryMeta(Country.IE).voltage).toBe(230)
  })

  it('returns correct voltage for AU (230V)', () => {
    expect(getCountryMeta(Country.AU).voltage).toBe(230)
  })

  it('returns the country code in the meta', () => {
    expect(getCountryMeta(Country.US).code).toBe('US')
  })
})

describe('getSupportedCountries()', () => {
  it('returns US, IE, and AU', () => {
    const supported = getSupportedCountries()
    const codes = supported.map((c) => c.code)
    expect(codes).toContain('US')
    expect(codes).toContain('IE')
    expect(codes).toContain('AU')
  })

  it('returns exactly 3 supported countries', () => {
    expect(getSupportedCountries()).toHaveLength(3)
  })
})

describe('hasVoltageChange()', () => {
  it('returns true when moving from US (120V) to Ireland (230V)', () => {
    expect(hasVoltageChange(Country.US, [Country.IE])).toBe(true)
  })

  it('returns true when moving from US (120V) to Australia (230V)', () => {
    expect(hasVoltageChange(Country.US, [Country.AU])).toBe(true)
  })

  it('returns false when moving from IE (230V) to AU (230V)', () => {
    expect(hasVoltageChange(Country.IE, [Country.AU])).toBe(false)
  })

  it('returns false when moving from US (120V) to CA (120V)', () => {
    expect(hasVoltageChange(Country.US, [Country.CA])).toBe(false)
  })

  it('returns true when any destination differs', () => {
    // CA is same voltage as US but IE differs
    expect(hasVoltageChange(Country.US, [Country.CA, Country.IE])).toBe(true)
  })

  it('returns false for empty destinations array', () => {
    expect(hasVoltageChange(Country.US, [])).toBe(false)
  })
})
