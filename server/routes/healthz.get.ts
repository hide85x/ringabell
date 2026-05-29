import { nowUtc } from '~~/utils/date'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)

  try {
    const db = await getDb({ mongodbUri: config.mongodbUri })
    await db.command({ ping: 1 })
    return { status: 'ok', db: 'connected', timestamp: nowUtc() }
  } catch (err) {
    setResponseStatus(event, 503)
    return { status: 'error', db: 'disconnected', error: String(err) }
  }
})
