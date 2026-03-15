import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VerdictBadge } from './VerdictBadge'
import { Verdict } from '@/lib/constants'

describe('VerdictBadge', () => {
  it('renders SHIP label', () => {
    render(<VerdictBadge verdict={Verdict.SHIP} />)
    expect(screen.getByText('SHIP')).toBeInTheDocument()
  })

  it('renders SELL label', () => {
    render(<VerdictBadge verdict={Verdict.SELL} />)
    expect(screen.getByText('SELL')).toBeInTheDocument()
  })

  it('renders DONATE label', () => {
    render(<VerdictBadge verdict={Verdict.DONATE} />)
    expect(screen.getByText('DONATE')).toBeInTheDocument()
  })

  it('renders DISCARD label', () => {
    render(<VerdictBadge verdict={Verdict.DISCARD} />)
    expect(screen.getByText('DISCARD')).toBeInTheDocument()
  })

  it('renders CARRY label', () => {
    render(<VerdictBadge verdict={Verdict.CARRY} />)
    expect(screen.getByText('CARRY')).toBeInTheDocument()
  })

  it('renders DECIDE_LATER as "DECIDE LATER" (with a space)', () => {
    render(<VerdictBadge verdict={Verdict.DECIDE_LATER} />)
    expect(screen.getByText('DECIDE LATER')).toBeInTheDocument()
  })

  it('SHIP badge passes green verdict colours to Badge', () => {
    const { container } = render(<VerdictBadge verdict={Verdict.SHIP} />)
    const badge = container.firstChild as HTMLElement
    expect(badge.style.backgroundColor).toBe('var(--verdict-ship-bg)')
    expect(badge.style.color).toBe('var(--verdict-ship-fg)')
  })

  it('SELL badge passes amber verdict colours to Badge', () => {
    const { container } = render(<VerdictBadge verdict={Verdict.SELL} />)
    const badge = container.firstChild as HTMLElement
    expect(badge.style.backgroundColor).toBe('var(--verdict-sell-bg)')
    expect(badge.style.color).toBe('var(--verdict-sell-fg)')
  })

  it('DONATE badge passes donate verdict colours to Badge', () => {
    const { container } = render(<VerdictBadge verdict={Verdict.DONATE} />)
    const badge = container.firstChild as HTMLElement
    expect(badge.style.backgroundColor).toBe('var(--verdict-donate-bg)')
    expect(badge.style.color).toBe('var(--verdict-donate-fg)')
  })

  it('DISCARD badge passes discard verdict colours to Badge', () => {
    const { container } = render(<VerdictBadge verdict={Verdict.DISCARD} />)
    const badge = container.firstChild as HTMLElement
    expect(badge.style.backgroundColor).toBe('var(--verdict-discard-bg)')
    expect(badge.style.color).toBe('var(--verdict-discard-fg)')
  })

  it('CARRY badge passes green verdict colours to Badge', () => {
    const { container } = render(<VerdictBadge verdict={Verdict.CARRY} />)
    const badge = container.firstChild as HTMLElement
    expect(badge.style.backgroundColor).toBe('var(--verdict-carry-bg)')
    expect(badge.style.color).toBe('var(--verdict-carry-fg)')
  })

  it('DECIDE_LATER badge passes blue verdict colours to Badge', () => {
    const { container } = render(<VerdictBadge verdict={Verdict.DECIDE_LATER} />)
    const badge = container.firstChild as HTMLElement
    expect(badge.style.backgroundColor).toBe('var(--verdict-decide-later-bg)')
    expect(badge.style.color).toBe('var(--verdict-decide-later-fg)')
  })

  it('accepts a custom className', () => {
    const { container } = render(<VerdictBadge verdict={Verdict.SHIP} className="custom-class" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toMatch(/custom-class/)
  })
})
