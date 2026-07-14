import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import 'dayjs/locale/pl'

dayjs.extend(utc)

export interface CalendarCell {
  date: string
  day: number
  inMonth: boolean
}

/**
 * Builds a full-week calendar grid (Monday-start) for the given year/month.
 * `month` is 0-indexed (January = 0), matching JS Date/dayjs convention.
 */
export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const firstOfMonth = dayjs.utc(new Date(Date.UTC(year, month, 1)))
  const daysInMonth = firstOfMonth.daysInMonth()

  // dayjs .day() is 0=Sunday..6=Saturday; shift so Monday=0..Sunday=6
  const leadingOffset = (firstOfMonth.day() + 6) % 7

  const cells: CalendarCell[] = []

  for (let i = leadingOffset; i > 0; i--) {
    const d = firstOfMonth.subtract(i, 'day')
    cells.push({ date: d.format('YYYY-MM-DD'), day: d.date(), inMonth: false })
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = firstOfMonth.date(day)
    cells.push({ date: d.format('YYYY-MM-DD'), day, inMonth: true })
  }

  const trailingOffset = (7 - (cells.length % 7)) % 7
  const lastOfMonth = firstOfMonth.date(daysInMonth)
  for (let i = 1; i <= trailingOffset; i++) {
    const d = lastOfMonth.add(i, 'day')
    cells.push({ date: d.format('YYYY-MM-DD'), day: d.date(), inMonth: false })
  }

  return cells
}
