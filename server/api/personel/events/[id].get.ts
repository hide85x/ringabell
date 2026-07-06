export default defineEventHandler(async (event) => {
  const session = await requirePersonel(event)
  const id = getRouterParam(event, 'id')
  const db = getD1(event)
  const email = session.user.email

  // 1. Event (published only)
  const ev = await db
    .prepare('SELECT id, name, date, venue, status, created_at AS createdAt FROM events WHERE id = ? AND status = \'published\'')
    .bind(id)
    .first() as { id: string; name: string; date: string; venue: string; status: string; createdAt: string } | null
  if (!ev) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }

  // 2. Person's event-level assignments
  const { results: eventRoleRows } = await db
    .prepare(
      `SELECT a.role
       FROM assignments a
       JOIN persons p ON p.id = a.person_id
       WHERE a.type = 'event' AND a.event_id = ? AND p.email = ?`,
    )
    .bind(id, email)
    .all() as { results: { role: string }[] }
  const eventRoles = eventRoleRows.map(r => r.role)

  // 3. Person's fight-level assignments
  const { results: fightAssignments } = await db
    .prepare(
      `SELECT f.id AS fightId, f.order_number AS orderNumber, a.role
       FROM assignments a
       JOIN persons p ON p.id = a.person_id
       JOIN fights f ON f.id = a.fight_id
       WHERE a.type = 'fight' AND f.event_id = ? AND p.email = ?
       ORDER BY f.order_number ASC`,
    )
    .bind(id, email)
    .all() as { results: { fightId: string; orderNumber: number; role: string }[] }

  // Verify person is assigned to this event
  if (eventRoles.length === 0 && fightAssignments.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }

  return {
    ...ev,
    eventRoles,
    fightAssignments,
  }
})
