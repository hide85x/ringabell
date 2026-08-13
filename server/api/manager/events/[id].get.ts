export default defineEventHandler(async (event) => {
  await requireManager(event)
  const id = getRouterParam(event, 'id')
  const db = getD1(event)

  // 1. Event
  const ev = await db
    .prepare('SELECT id, name, date, venue, status, created_at AS createdAt FROM events WHERE id = ?')
    .bind(id)
    .first() as { id: string; name: string; date: string; venue: string; status: string; createdAt: string } | null
  if (!ev) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }

  // 2. Fights
  const { results: fights } = await db
    .prepare('SELECT id, order_number AS orderNumber, created_at AS createdAt FROM fights WHERE event_id = ? ORDER BY order_number ASC')
    .bind(id)
    .all() as { results: { id: string; orderNumber: number; createdAt: string }[] }

  const fightIds = fights.map(f => f.id)

  // 3. Fight requirements
  let requirements: { id: string; fightId: string; role: string; count: number; hasCorner: number }[] = []
  if (fightIds.length > 0) {
    const placeholders = fightIds.map(() => '?').join(', ')
    const { results } = await db
      .prepare(`SELECT id, fight_id AS fightId, role, count, has_corner AS hasCorner FROM fight_requirements WHERE fight_id IN (${placeholders})`)
      .bind(...fightIds)
      .all() as { results: { id: string; fightId: string; role: string; count: number; hasCorner: number }[] }
    requirements = results
  }

  // 4. Fight assignments
  let fightAssignments: { id: string; fightId: string; personId: string; personName: string; role: string; corner: string | null }[] = []
  if (fightIds.length > 0) {
    const placeholders = fightIds.map(() => '?').join(', ')
    const { results } = await db
      .prepare(
        `SELECT a.id, a.fight_id AS fightId, a.person_id AS personId, p.name AS personName, a.role, a.corner
         FROM assignments a
         JOIN persons p ON p.id = a.person_id
         WHERE a.type = 'fight' AND a.fight_id IN (${placeholders})`,
      )
      .bind(...fightIds)
      .all() as { results: { id: string; fightId: string; personId: string; personName: string; role: string; corner: string | null }[] }
    fightAssignments = results
  }

  // 5. Event assignments (event-level roles, e.g. ratownik, konferansjer)
  const { results: eventAssignments } = await db
    .prepare(
      `SELECT a.id, a.person_id AS personId, p.name AS personName, a.role
       FROM assignments a
       JOIN persons p ON p.id = a.person_id
       WHERE a.type = 'event' AND a.event_id = ?`,
    )
    .bind(id)
    .all() as { results: { id: string; personId: string; personName: string; role: string }[] }

  // 6. Available persons (active only)
  const { results: availablePersons } = await db
    .prepare('SELECT id, name, role FROM persons WHERE is_active = 1 ORDER BY name ASC')
    .all() as { results: { id: string; name: string; role: string }[] }

  // 7. Conflicting person IDs (assigned to another non-cancelled event on same date)
  const { results: conflictRows } = await db
    .prepare(
      `SELECT DISTINCT a.person_id AS personId
       FROM assignments a
       JOIN fights f ON f.id = a.fight_id
       JOIN events e ON e.id = f.event_id
       WHERE e.date = ? AND e.id != ? AND e.status != 'cancelled'
       UNION
       SELECT DISTINCT a.person_id AS personId
       FROM assignments a
       JOIN events e ON e.id = a.event_id
       WHERE e.date = ? AND e.id != ? AND e.status != 'cancelled'`,
    )
    .bind(ev.date, id, ev.date, id)
    .all() as { results: { personId: string }[] }
  const conflictingPersonIds = conflictRows.map(r => r.personId)

  // Assemble nested structure
  const fightsWithData = fights.map(fight => ({
    ...fight,
    requirements: requirements.filter(r => r.fightId === fight.id),
    assignments: fightAssignments.filter(a => a.fightId === fight.id),
  }))

  return {
    ...ev,
    fights: fightsWithData,
    eventAssignments,
    availablePersons,
    conflictingPersonIds,
  }
})
