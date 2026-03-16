import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CostSummary, type CostSummaryData } from './CostSummary'

// Mock framer-motion — avoid animation complexities in unit tests
vi.mock('framer-motion', () => ({
  motion: {
    span: ({ children, ...rest }: React.HTMLAttributes<HTMLSpanElement> & { children?: React.ReactNode }) => (
      <span {...rest}>{children}</span>
    ),
  },
  useReducedMotion: () => false,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function makeData(overrides: Partial<CostSummaryData> = {}): CostSummaryData {
  return {
    counts_by_verdict: { SHIP: 3, SELL: 2, DONATE: 1 },
    total_estimated_ship_cost: 450,
    ship_currency: 'USD',
    ...overrides,
  }
}

describe('CostSummary — full variant', () => {
  it('displays the formatted total ship cost', () => {
    render(<CostSummary data={makeData()} variant="full" />)
    // Formatted as currency via Intl.NumberFormat — check for "$450" or "US$450" etc.
    expect(screen.getByText(/450/)).toBeInTheDocument()
  })

  it('shows the currency label', () => {
    render(<CostSummary data={makeData()} variant="full" />)
    expect(screen.getByText('USD')).toBeInTheDocument()
  })

  it('shows the total item count', () => {
    // 3 SHIP + 2 SELL + 1 DONATE = 6 items
    render(<CostSummary data={makeData()} variant="full" />)
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText(/items/)).toBeInTheDocument()
  })

  it('uses singular "item" for count of 1', () => {
    render(
      <CostSummary
        data={makeData({ counts_by_verdict: { SHIP: 1 } })}
        variant="full"
      />
    )
    expect(screen.getByText(/\bitem\b/)).toBeInTheDocument()
  })

  it('renders a verdict chip for each verdict with a non-zero count', () => {
    render(<CostSummary data={makeData()} variant="full" />)
    expect(screen.getByText(/3 SHIP/i)).toBeInTheDocument()
    expect(screen.getByText(/2 SELL/i)).toBeInTheDocument()
    expect(screen.getByText(/1 DONATE/i)).toBeInTheDocument()
  })

  it('does not render chips for zero-count verdicts', () => {
    render(
      <CostSummary
        data={makeData({ counts_by_verdict: { SHIP: 3, SELL: 0 } })}
        variant="full"
      />
    )
    expect(screen.queryByText(/0 SELL/i)).not.toBeInTheDocument()
  })

  it('handles zero total ship cost gracefully', () => {
    render(
      <CostSummary
        data={makeData({ total_estimated_ship_cost: 0 })}
        variant="full"
      />
    )
    // Should still render — just $0 or €0
    expect(screen.getByText(/0/)).toBeInTheDocument()
  })

  it('handles empty counts_by_verdict gracefully', () => {
    render(
      <CostSummary
        data={makeData({ counts_by_verdict: {} })}
        variant="full"
      />
    )
    // 0 items
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})

describe('CostSummary — compact variant', () => {
  it('renders in compact mode without crashing', () => {
    render(<CostSummary data={makeData()} variant="compact" />)
    // Compact shows cost and item count but not verdict chips
    expect(screen.getByText(/450/)).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
  })

  it('compact variant does not render verdict chips', () => {
    render(<CostSummary data={makeData()} variant="compact" />)
    expect(screen.queryByText(/3 SHIP/i)).not.toBeInTheDocument()
  })

  it('compact variant shows item count with label', () => {
    render(<CostSummary data={makeData()} variant="compact" />)
    expect(screen.getByText(/items/)).toBeInTheDocument()
  })
})

describe('CostSummary — currency display', () => {
  it('formats EUR ship currency', () => {
    render(
      <CostSummary
        data={makeData({ total_estimated_ship_cost: 300, ship_currency: 'EUR' })}
        variant="full"
      />
    )
    expect(screen.getByText('EUR')).toBeInTheDocument()
    expect(screen.getByText(/300/)).toBeInTheDocument()
  })

  it('shows replacement cost when provided', () => {
    render(
      <CostSummary
        data={makeData({
          total_estimated_replace_cost: 1200,
          replace_currency: 'EUR',
        })}
        variant="full"
      />
    )
    expect(screen.getByText('EUR')).toBeInTheDocument()
    expect(screen.getByText(/1[,.]?200/)).toBeInTheDocument()
  })

  it('does not show replacement cost section when total is 0', () => {
    render(
      <CostSummary
        data={makeData({
          total_estimated_replace_cost: 0,
          replace_currency: 'EUR',
        })}
        variant="full"
      />
    )
    expect(screen.queryByText(/Est. replacement/i)).not.toBeInTheDocument()
  })
})
