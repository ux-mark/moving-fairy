import { describe, expect, it } from 'vitest'

import {
  UNPACKED,
  buildItemBoxIndex,
  formatPackageParam,
  matchesItemFilters,
  matchesPackageFilter,
  parsePackageParam,
} from './package-filter'

describe('parsePackageParam', () => {
  it('returns empty for null or empty', () => {
    expect(parsePackageParam(null)).toEqual([])
    expect(parsePackageParam('')).toEqual([])
  })

  it('splits on commas, trims, drops blanks, dedupes', () => {
    expect(parsePackageParam('a, b,,a,none')).toEqual(['a', 'b', 'none'])
  })

  it('round-trips with formatPackageParam', () => {
    expect(parsePackageParam(formatPackageParam(['a', 'none']))).toEqual(['a', 'none'])
  })
})

describe('buildItemBoxIndex', () => {
  it('maps item ids to the boxes that contain them, skipping unlinked rows', () => {
    const index = buildItemBoxIndex([
      { id: 'box-1', items: [{ item_assessment_id: 'i1' }, { item_assessment_id: null }] },
      { id: 'box-2', items: [{ item_assessment_id: 'i2' }, { item_assessment_id: 'i1' }] },
    ])
    expect(index.get('i1')).toEqual(new Set(['box-1', 'box-2']))
    expect(index.get('i2')).toEqual(new Set(['box-2']))
    expect(index.has('i3')).toBe(false)
  })
})

describe('matchesPackageFilter', () => {
  const inBox1 = new Set(['box-1'])
  const inBox2 = new Set(['box-2'])

  it('empty selection matches everything (no filtering)', () => {
    expect(matchesPackageFilter([], inBox1)).toBe(true)
    expect(matchesPackageFilter([], undefined)).toBe(true)
  })

  it('matches items in a selected box only', () => {
    expect(matchesPackageFilter(['box-1'], inBox1)).toBe(true)
    expect(matchesPackageFilter(['box-1'], inBox2)).toBe(false)
    expect(matchesPackageFilter(['box-1'], undefined)).toBe(false)
  })

  it('multi-select uses OR semantics', () => {
    expect(matchesPackageFilter(['box-1', 'box-2'], inBox1)).toBe(true)
    expect(matchesPackageFilter(['box-1', 'box-2'], inBox2)).toBe(true)
    expect(matchesPackageFilter(['box-1', 'box-2'], new Set(['box-3']))).toBe(false)
  })

  it('UNPACKED matches items in no box', () => {
    expect(matchesPackageFilter([UNPACKED], undefined)).toBe(true)
    expect(matchesPackageFilter([UNPACKED], new Set())).toBe(true)
    expect(matchesPackageFilter([UNPACKED], inBox1)).toBe(false)
  })

  it('UNPACKED combines with box ids via OR', () => {
    expect(matchesPackageFilter([UNPACKED, 'box-1'], undefined)).toBe(true)
    expect(matchesPackageFilter([UNPACKED, 'box-1'], inBox1)).toBe(true)
    expect(matchesPackageFilter([UNPACKED, 'box-1'], inBox2)).toBe(false)
  })

  it('unknown/stale box ids match nothing', () => {
    expect(matchesPackageFilter(['deleted-box'], inBox1)).toBe(false)
  })
})

describe('matchesItemFilters (status AND package)', () => {
  const statuses = new Set(['to-pack', 'done'])
  const inBox1 = new Set(['box-1'])

  it('requires the status bucket to be active', () => {
    expect(matchesItemFilters('to-sell', statuses, [], inBox1)).toBe(false)
    expect(matchesItemFilters(null, statuses, [], inBox1)).toBe(false)
    expect(matchesItemFilters('to-pack', statuses, [], inBox1)).toBe(true)
  })

  it('ANDs status with the package selection', () => {
    expect(matchesItemFilters('to-pack', statuses, ['box-1'], inBox1)).toBe(true)
    expect(matchesItemFilters('to-pack', statuses, ['box-2'], inBox1)).toBe(false)
    expect(matchesItemFilters('to-sell', statuses, ['box-1'], inBox1)).toBe(false)
    expect(matchesItemFilters('done', statuses, [UNPACKED], undefined)).toBe(true)
  })

  it('empty package selection leaves status-only behaviour intact', () => {
    expect(matchesItemFilters('done', statuses, [], undefined)).toBe(true)
  })
})
