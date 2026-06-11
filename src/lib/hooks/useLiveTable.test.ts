import { describe, expect, it } from 'vitest'
import { mergeLiveEvent, type LiveTableEvent } from './useLiveTable'

interface Row {
  id: string
  name: string
  rank: number
  // Stand-in for a joined field the realtime payload never carries
  // (e.g. box.items, listing.item_assessment).
  joined?: string[]
}

const rows: Row[] = [
  { id: 'a', name: 'Alpha', rank: 1, joined: ['x'] },
  { id: 'b', name: 'Beta', rank: 2 },
]

const insert = (row: Row): LiveTableEvent<Row> => ({
  eventType: 'INSERT',
  new: row,
  old: null,
})
const update = (row: Row): LiveTableEvent<Row> => ({
  eventType: 'UPDATE',
  new: row,
  old: { id: row.id },
})
const del = (id: string): LiveTableEvent<Row> => ({
  eventType: 'DELETE',
  new: null,
  old: { id },
})

describe('mergeLiveEvent', () => {
  describe('INSERT', () => {
    it('appends a new row', () => {
      const next = mergeLiveEvent(rows, insert({ id: 'c', name: 'Gamma', rank: 3 }))
      expect(next.map((r) => r.id)).toEqual(['a', 'b', 'c'])
    })

    it('does not duplicate an echo of an optimistic add (merges by id)', () => {
      const next = mergeLiveEvent(rows, insert({ id: 'b', name: 'Beta (server)', rank: 2 }))
      expect(next).toHaveLength(2)
      expect(next.find((r) => r.id === 'b')?.name).toBe('Beta (server)')
    })

    it('preserves joined fields when an echo replaces an existing row', () => {
      const next = mergeLiveEvent(rows, insert({ id: 'a', name: 'Alpha v2', rank: 1 }))
      expect(next.find((r) => r.id === 'a')).toMatchObject({
        name: 'Alpha v2',
        joined: ['x'],
      })
    })

    it('respects the sort comparator', () => {
      const byRank = (a: Row, b: Row) => a.rank - b.rank
      const next = mergeLiveEvent(rows, insert({ id: 'z', name: 'Zero', rank: 0 }), byRank)
      expect(next.map((r) => r.id)).toEqual(['z', 'a', 'b'])
    })

    it('ignores a payload with no row', () => {
      const next = mergeLiveEvent(rows, { eventType: 'INSERT', new: null, old: null })
      expect(next).toBe(rows)
    })
  })

  describe('UPDATE', () => {
    it('replaces fields on the matching row only', () => {
      const next = mergeLiveEvent(rows, update({ id: 'b', name: 'Beta v2', rank: 5 }))
      expect(next.find((r) => r.id === 'b')).toMatchObject({ name: 'Beta v2', rank: 5 })
      expect(next.find((r) => r.id === 'a')).toBe(rows[0])
    })

    it('shallow-merges so joined fields survive a bare WAL row', () => {
      const next = mergeLiveEvent(rows, update({ id: 'a', name: 'Alpha v2', rank: 1 }))
      expect(next.find((r) => r.id === 'a')?.joined).toEqual(['x'])
    })

    it('adopts an update for a row it never saw (missed INSERT)', () => {
      const next = mergeLiveEvent(rows, update({ id: 'c', name: 'Gamma', rank: 3 }))
      expect(next).toHaveLength(3)
      expect(next.find((r) => r.id === 'c')?.name).toBe('Gamma')
    })

    it('re-sorts after an update when a comparator is given', () => {
      const byRank = (a: Row, b: Row) => a.rank - b.rank
      const next = mergeLiveEvent(rows, update({ id: 'a', name: 'Alpha', rank: 9 }), byRank)
      expect(next.map((r) => r.id)).toEqual(['b', 'a'])
    })
  })

  describe('DELETE', () => {
    it('removes the matching row', () => {
      const next = mergeLiveEvent(rows, del('a'))
      expect(next.map((r) => r.id)).toEqual(['b'])
    })

    it('is a no-op returning the same reference when the row is already gone (echo)', () => {
      const next = mergeLiveEvent(rows, del('zz'))
      expect(next).toBe(rows)
    })

    it('is a no-op when the old tuple carries no id', () => {
      const next = mergeLiveEvent(rows, { eventType: 'DELETE', new: null, old: {} })
      expect(next).toBe(rows)
    })
  })

  it('never mutates the input array', () => {
    const before = [...rows]
    mergeLiveEvent(rows, insert({ id: 'c', name: 'Gamma', rank: 3 }))
    mergeLiveEvent(rows, update({ id: 'a', name: 'Alpha v2', rank: 7 }))
    mergeLiveEvent(rows, del('b'))
    expect(rows).toEqual(before)
  })
})
