import { describe, it, expect } from 'vitest'
import { BOX_SIZE_CBM, BoxSize, Country, OnwardTimeline, Verdict, BoxType, BoxStatus, roomFamily, uniqueRoomCode, computeBoxLabel } from './constants'

describe('roomFamily()', () => {
  it('returns the first word, lowercased, for multi-word names', () => {
    expect(roomFamily('Bedroom 1')).toBe('bedroom')
    expect(roomFamily('Bedroom 2')).toBe('bedroom')
    expect(roomFamily('Kitchen WH19')).toBe('kitchen')
    expect(roomFamily('Camping & Kitchen')).toBe('camping')
  })

  it('lowercases and trims a single-word name', () => {
    expect(roomFamily('  Garage  ')).toBe('garage')
    expect(roomFamily('OFFICE')).toBe('office')
  })

  it('returns empty string when there is no word', () => {
    expect(roomFamily('')).toBe('')
    expect(roomFamily('   ')).toBe('')
  })

  it('groups Bedroom variants to one family but keeps distinct families apart', () => {
    expect(roomFamily('Bedroom 1')).toBe(roomFamily('Bedroom 3'))
    expect(roomFamily('Bedroom')).not.toBe(roomFamily('Books'))
  })
})

describe('uniqueRoomCode()', () => {
  it('returns the base single letter when unused', () => {
    expect(uniqueRoomCode('Bedroom', new Set())).toBe('B')
    expect(uniqueRoomCode('Kitchen', new Set())).toBe('K')
  })

  it('extends with the next consonant when the base collides (Books → Bk)', () => {
    expect(uniqueRoomCode('Books', new Set(['B']))).toBe('Bk')
  })

  it('skips vowels when choosing the extension consonant (Attic → At? no — base A, next consonant t)', () => {
    expect(uniqueRoomCode('Attic', new Set(['A']))).toBe('At')
  })

  it('falls back to the next letter when no consonant is free', () => {
    // "Bee" → base B; consonants after the leading B: none (e, e are vowels) →
    // next letter is 'e'.
    expect(uniqueRoomCode('Bee', new Set(['B']))).toBe('Be')
  })

  it('falls back to a digit when all letter extensions are taken', () => {
    expect(uniqueRoomCode('Bo', new Set(['B', 'Bo']))).toBe('B2')
  })

  it('never returns a code already in usedCodes', () => {
    const used = new Set(['B', 'Bk'])
    const code = uniqueRoomCode('Books', used)
    expect(used.has(code)).toBe(false)
  })
})

describe('computeBoxLabel() with explicit code', () => {
  it('uses the passed code for a standard box', () => {
    expect(computeBoxLabel(BoxType.STANDARD, 'Books', 4, undefined, 'Bk')).toBe('WH04-Bk')
  })

  it('falls back to roomCode() when no code is passed', () => {
    expect(computeBoxLabel(BoxType.STANDARD, 'Books', 4)).toBe('WH04-B')
  })

  it('ignores the code for codeless box types', () => {
    // Luggage/carry-on have no warehouse code; single-item uses a bare WH number.
    expect(computeBoxLabel(BoxType.CHECKED_LUGGAGE, 'Checked Luggage', 1, undefined, 'X')).toBe('Checked Luggage')
    expect(computeBoxLabel(BoxType.CARRYON, 'Carry-on', 2, undefined, 'X')).toBe('Carry-on')
    expect(computeBoxLabel(BoxType.SINGLE_ITEM, 'Monitor', 7, undefined, 'X')).toBe('WH07')
  })
})

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
    const expected = ['SELL', 'DONATE', 'DISCARD', 'SHIP', 'CARRY', 'REVISIT']
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
