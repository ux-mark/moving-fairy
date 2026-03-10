import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn()', () => {
  it('returns a single class unchanged', () => {
    expect(cn('foo')).toBe('foo')
  })

  it('merges multiple classes', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes — truthy', () => {
    expect(cn('foo', true && 'bar')).toBe('foo bar')
  })

  it('handles conditional classes — falsy', () => {
    expect(cn('foo', false && 'bar')).toBe('foo')
  })

  it('deduplicates conflicting tailwind classes (last wins)', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('handles arrays', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })

  it('handles objects with boolean values', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz')
  })

  it('returns empty string when nothing is passed', () => {
    expect(cn()).toBe('')
  })
})
