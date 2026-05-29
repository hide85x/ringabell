import { nowUtc } from '~~/utils/date'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)

  try {
    const db = await getDb({ mongodbUri: config.mongodbUri })
    const pingTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('MongoDB ping timed out after 4000ms')), 4000)
    )
    await Promise.race([db.command({ ping: 1 }), pingTimeout])
    return { status: 'ok', db: 'connected', timestamp: nowUtc() }
  } catch (err) {
    clearDbCache()
    setResponseStatus(event, 503)
    return { status: 'error', db: 'disconnected', error: String(err) }
  }
})
