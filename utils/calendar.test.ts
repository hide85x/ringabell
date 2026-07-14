import { describe, it, expect } from 'vitest'
import { buildMonthGrid } from './calendar'

describe('calendar utils', () => {
  it('marks all 29 days of a leap-year February as inMonth', () => {
    const grid = buildMonthGrid(2028, 1) // February 2028 is a leap year
    const inMonthDays = grid.filter(c => c.inMonth)
    expect(inMonthDays).toHaveLength(29)
    expect(inMonthDays[0]!.date).toBe('2028-02-01')
    expect(inMonthDays[28]!.date).toBe('2028-02-29')
  })

  it('marks all 28 days of a non-leap-year February as inMonth', () => {
    const grid = buildMonthGrid(2027, 1)
    const inMonthDays = grid.filter(c => c.inMonth)
    expect(inMonthDays).toHaveLength(28)
    expect(inMonthDays[27]!.date).toBe('2027-02-28')
  })

  it('has zero leading out-of-month days when the 1st falls on Monday', () => {
    // 2027-02-01 is a Monday
    const grid = buildMonthGrid(2027, 1)
    expect(grid[0]!.date).toBe('2027-02-01')
    expect(grid[0]!.inMonth).toBe(true)
  })

  it('has 6 leading out-of-month days when the 1st falls on Sunday', () => {
    // 2026-11-01 is a Sunday
    const grid = buildMonthGrid(2026, 10)
    const leading = grid.filter(c => !c.inMonth && c.date < '2026-11-01')
    expect(leading).toHaveLength(6)
    expect(grid[0]!.date).toBe('2026-10-26')
  })

  it('rolls over year correctly across a December/January boundary', () => {
    const grid = buildMonthGrid(2026, 11) // December 2026
    const inMonthDays = grid.filter(c => c.inMonth)
    expect(inMonthDays[0]!.date).toBe('2026-12-01')
    expect(inMonthDays[30]!.date).toBe('2026-12-31')
    const trailing = grid.filter(c => !c.inMonth && c.date > '2026-12-31')
    for (const cell of trailing) {
      expect(cell.date.startsWith('2027-01')).toBe(true)
    }
  })

  it('always returns a length that is a multiple of 7', () => {
    for (let month = 0; month < 12; month++) {
      expect(buildMonthGrid(2026, month).length % 7).toBe(0)
    }
  })
})
