import { describe, it, expect } from 'vitest'
import { BOX_SIZE_CBM, BoxSize, Country, OnwardTimeline, Verdict, BoxType, BoxStatus } from './constants'

describe('BOX_SIZE_CBM values', () => {
  it('XS is 0.04 CBM', () => {
    expect(BOX_SIZE_CBM[BoxSize.XS]).toBe(0.04)
  })

  it('S is 0.07 CBM', () => {
    expect(BOX_SIZE_CBM[BoxSize.S]).toBe(0.07)
  })

  it('M is 0.15 CBM', () => {
    expect(BOX_SIZE_CBM[BoxSize.M]).toBe(0.15)
  })

  it('L is 0.25 CBM', () => {
    expect(BOX_SIZE_CBM[BoxSize.L]).toBe(0.25)
  })

  it('XS is smaller than S', () => {
    expect(BOX_SIZE_CBM[BoxSize.XS]).toBeLessThan(BOX_SIZE_CBM[BoxSize.S])
  })

  it('all sizes have positive CBM values', () => {
    for (const val of Object.values(BOX_SIZE_CBM)) {
      expect(val).toBeGreaterThan(0)
    }
  })
})

describe('Country enum', () => {
  it('includes US, IE, AU, CA, UK, NZ', () => {
    expect(Object.values(Country)).toContain('US')
    expect(Object.values(Country)).toContain('IE')
    expect(Object.values(Country)).toContain('AU')
    expect(Object.values(Country)).toContain('CA')
    expect(Object.values(Country)).toContain('UK')
    expect(Object.values(Country)).toContain('NZ')
  })
})

describe('OnwardTimeline enum', () => {
  it('contains expected values', () => {
    expect(Object.values(OnwardTimeline)).toContain('1_2yr')
    expect(Object.values(OnwardTimeline)).toContain('3_5yr')
    expect(Object.values(OnwardTimeline)).toContain('5yr_plus')
    expect(Object.values(OnwardTimeline)).toContain('undecided')
  })
})

describe('Verdict enum', () => {
  it('contains all six verdicts', () => {
    const expected = ['SELL', 'DONATE', 'DISCARD', 'SHIP', 'CARRY', 'DECIDE_LATER']
    for (const v of expected) {
      expect(Object.values(Verdict)).toContain(v)
    }
  })
})

describe('BoxType enum', () => {
  it('contains expected types', () => {
    expect(Object.values(BoxType)).toContain('standard')
    expect(Object.values(BoxType)).toContain('checked_luggage')
    expect(Object.values(BoxType)).toContain('carryon')
    expect(Object.values(BoxType)).toContain('single_item')
  })
})

describe('BoxStatus enum', () => {
  it('contains expected statuses', () => {
    expect(Object.values(BoxStatus)).toContain('packing')
    expect(Object.values(BoxStatus)).toContain('packed')
    expect(Object.values(BoxStatus)).toContain('shipped')
    expect(Object.values(BoxStatus)).toContain('arrived')
  })
})
