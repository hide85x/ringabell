import { nowUtc } from '~~/utils/date'

export default defineEventHandler(async (event) => {
  await requireManager(event)
  const eventId = getRouterParam(event, 'id')
  const db = getD1(event)

  const ev = await db
    .prepare('SELECT id, status FROM events WHERE id = ?')
    .bind(eventId)
    .first() as { id: string; status: string } | null
  if (!ev) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }
  if (ev.status !== 'draft') {
    throw createError({ statusCode: 409, statusMessage: 'Event is not a draft' })
  }

  const countRow = await db
    .prepare('SELECT COUNT(*) AS cnt FROM fights WHERE event_id = ?')
    .bind(eventId)
    .first() as { cnt: number }
  const orderNumber = (countRow?.cnt ?? 0) + 1

  const fightId = crypto.randomUUID()
  await db
    .prepare('INSERT INTO fights (id, event_id, order_number, created_at) VALUES (?, ?, ?, ?)')
    .bind(fightId, eventId, orderNumber, nowUtc())
    .run()

  // Auto-copy fight_requirement_defaults
  const { results: defaults } = await db
    .prepare(
      `SELECT pr.name AS role, frd.count
       FROM fight_requirement_defaults frd
       JOIN person_roles pr ON pr.id = frd.role_id`,
    )
    .all() as { results: { role: string; count: number }[] }

  for (const def of defaults) {
    await db
      .prepare('INSERT INTO fight_requirements (id, fight_id, role, count) VALUES (?, ?, ?, ?)')
      .bind(crypto.randomUUID(), fightId, def.role, def.count)
      .run()
  }

  setResponseStatus(event, 201)
  return { ok: true, id: fightId }
})
