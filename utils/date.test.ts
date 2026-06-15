import { describe, it, expect } from 'vitest'
import { formatDate, nowUtc } from './date'

describe('date utils', () => {
  it('formatDate returns UTC date in YYYY-MM-DD HH:mm format', () => {
    expect(formatDate('2026-01-15T10:30:00Z')).toBe('2026-01-15 10:30')
  })

  it('nowUtc returns a valid ISO 8601 UTC string', () => {
    expect(nowUtc()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })
})
