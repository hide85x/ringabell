import { nowUtc } from '~~/utils/date'

export default defineEventHandler(async (event) => {
  await requireManager(event)
  const body = await readBody<{ name?: string; date?: string; venue?: string }>(event)

  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }
  if (!body?.date?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'date is required' })
  }
  if (!body?.venue?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'venue is required' })
  }

  const db = getD1(event)
  const id = crypto.randomUUID()
  await db
    .prepare(
      'INSERT INTO events (id, name, date, venue, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(id, body.name.trim(), body.date.trim(), body.venue.trim(), 'draft', nowUtc())
    .run()

  setResponseStatus(event, 201)
  return { ok: true, id }
})
