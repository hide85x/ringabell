import { nowUtc } from '~~/utils/date'

export default defineEventHandler(async (event) => {
  await requireManager(event)
  const body = await readBody<{
    personId?: string
    role?: string
    type?: string
    fightId?: string
    eventId?: string
  }>(event)
  const db = getD1(event)

  if (!body?.personId?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'personId is required' })
  }
  if (!body?.role?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'role is required' })
  }
  if (body?.type !== 'fight' && body?.type !== 'event') {
    throw createError({ statusCode: 400, statusMessage: 'type must be fight or event' })
  }
  if (body.type === 'fight' && !body.fightId?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'fightId is required for type=fight' })
  }
  if (body.type === 'event' && !body.eventId?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'eventId is required for type=event' })
  }

  const person = await db
    .prepare('SELECT id FROM persons WHERE id = ? AND is_active = 1')
    .bind(body.personId.trim())
    .first()
  if (!person) {
    throw createError({ statusCode: 404, statusMessage: 'Person not found or inactive' })
  }

  if (body.type === 'fight') {
    const fight = await db
      .prepare('SELECT id FROM fights WHERE id = ?')
      .bind(body.fightId!.trim())
      .first()
    if (!fight) {
      throw createError({ statusCode: 404, statusMessage: 'Fight not found' })
    }
  } else {
    const ev = await db
      .prepare('SELECT id FROM events WHERE id = ?')
      .bind(body.eventId!.trim())
      .first()
    if (!ev) {
      throw createError({ statusCode: 404, statusMessage: 'Event not found' })
    }
  }

  const id = crypto.randomUUID()
  await db
    .prepare(
      'INSERT INTO assignments (id, person_id, type, fight_id, event_id, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      id,
      body.personId.trim(),
      body.type,
      body.type === 'fight' ? body.fightId!.trim() : null,
      body.type === 'event' ? body.eventId!.trim() : null,
      body.role.trim(),
      nowUtc(),
    )
    .run()

  setResponseStatus(event, 201)
  return { ok: true, id }
})
