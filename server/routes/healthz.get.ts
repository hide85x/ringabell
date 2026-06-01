import { nowUtc } from '~~/utils/date'

export default defineEventHandler(async (event) => {
  try {
    const db = getD1(event)
    await db.prepare('SELECT 1').first()
    return { status: 'ok', db: 'connected', timestamp: nowUtc() }
  } catch {
    setResponseStatus(event, 503)
    return { status: 'error', db: 'disconnected' }
  }
})
