import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

/**
 * Format a date to a human-readable string in UTC.
 * Always use this instead of new Date().toISOString() or manual formatting.
 */
export function formatDate(date: dayjs.ConfigType, format = 'YYYY-MM-DD HH:mm'): string {
  return dayjs.utc(date).format(format)
}

/**
 * Return current UTC timestamp as ISO string.
 * Always use this instead of new Date().toISOString().
 */
export function nowUtc(): string {
  return dayjs.utc().toISOString()
}
