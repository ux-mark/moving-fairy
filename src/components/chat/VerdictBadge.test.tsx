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

  it('SHIP badge has green styling class', () => {
    const { container } = render(<VerdictBadge verdict={Verdict.SHIP} />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toMatch(/text-verdict-ship/)
  })

  it('SELL badge has amber styling class', () => {
    const { container } = render(<VerdictBadge verdict={Verdict.SELL} />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toMatch(/text-verdict-sell/)
  })

  it('DONATE badge has a donate styling class', () => {
    const { container } = render(<VerdictBadge verdict={Verdict.DONATE} />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toMatch(/text-verdict-donate/)
  })

  it('DISCARD badge has a discard styling class', () => {
    const { container } = render(<VerdictBadge verdict={Verdict.DISCARD} />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toMatch(/text-verdict-discard/)
  })

  it('CARRY badge has green styling class', () => {
    const { container } = render(<VerdictBadge verdict={Verdict.CARRY} />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toMatch(/text-verdict-carry/)
  })

  it('DECIDE_LATER badge has blue styling class', () => {
    const { container } = render(<VerdictBadge verdict={Verdict.DECIDE_LATER} />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toMatch(/text-verdict-decide-later/)
  })

  it('accepts a custom className', () => {
    const { container } = render(<VerdictBadge verdict={Verdict.SHIP} className="custom-class" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toMatch(/custom-class/)
  })
})
