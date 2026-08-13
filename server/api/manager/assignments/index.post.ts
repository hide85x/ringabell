import { nowUtc } from '~~/utils/date'

export default defineEventHandler(async (event) => {
  await requireManager(event)
  const body = await readBody<{
    personId?: string
    role?: string
    type?: string
    fightId?: string
    eventId?: string
    corner?: string
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
      .prepare('SELECT id, event_id FROM fights WHERE id = ?')
      .bind(body.fightId!.trim())
      .first() as { id: string; event_id: string } | null
    if (!fight) {
      throw createError({ statusCode: 404, statusMessage: 'Fight not found' })
    }
    if (body.role.trim().toLowerCase() === 'bokser') {
      const conflict = await db
        .prepare(
          `SELECT COUNT(*) AS cnt FROM assignments a
           JOIN fights f ON f.id = a.fight_id
           WHERE a.type = 'fight' AND LOWER(a.role) = 'bokser' AND a.person_id = ?
           AND f.event_id = ? AND a.fight_id != ?`,
        )
        .bind(body.personId.trim(), fight.event_id, fight.id)
        .first() as { cnt: number }
      if (conflict.cnt > 0) {
        throw createError({ statusCode: 409, statusMessage: 'Person already assigned as bokser to another fight in this event' })
      }
    }

    const requirement = await db
      .prepare('SELECT has_corner AS hasCorner FROM fight_requirements WHERE fight_id = ? AND LOWER(role) = LOWER(?) LIMIT 1')
      .bind(fight.id, body.role.trim())
      .first() as { hasCorner: number } | null
    const hasCorner = !!requirement?.hasCorner

    if (hasCorner) {
      if (body.corner !== 'red' && body.corner !== 'blue') {
        throw createError({ statusCode: 400, statusMessage: 'corner must be red or blue for this role' })
      }
      const oppositeCorner = body.corner === 'red' ? 'blue' : 'red'
      const duplicate = await db
        .prepare(
          `SELECT COUNT(*) AS cnt FROM assignments
           WHERE fight_id = ? AND LOWER(role) = LOWER(?) AND person_id = ? AND corner = ?`,
        )
        .bind(fight.id, body.role.trim(), body.personId.trim(), oppositeCorner)
        .first() as { cnt: number }
      if (duplicate.cnt > 0) {
        throw createError({ statusCode: 409, statusMessage: 'Person already assigned to the other corner of this fight for this role' })
      }
    }
    else if (body.corner) {
      throw createError({ statusCode: 400, statusMessage: 'corner must not be set for a role without a corner' })
    }
  } else {
    if (body.corner) {
      throw createError({ statusCode: 400, statusMessage: 'corner must not be set for event-level assignments' })
    }
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
      'INSERT INTO assignments (id, person_id, type, fight_id, event_id, role, corner, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      id,
      body.personId.trim(),
      body.type,
      body.type === 'fight' ? body.fightId!.trim() : null,
      body.type === 'event' ? body.eventId!.trim() : null,
      body.role.trim(),
      body.corner ?? null,
      nowUtc(),
    )
    .run()

  setResponseStatus(event, 201)
  return { ok: true, id }
})
