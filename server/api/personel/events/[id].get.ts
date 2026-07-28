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

  // 2. Verify person is assigned to this event
  const check = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM assignments a
       JOIN persons p ON p.id = a.person_id
       WHERE LOWER(p.email) = LOWER(?) AND (
         (a.type = 'event' AND a.event_id = ?)
         OR
         (a.type = 'fight' AND a.fight_id IN (SELECT id FROM fights WHERE event_id = ?))
       )`,
    )
    .bind(email, id, id)
    .first() as { cnt: number }
  if (!check.cnt) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }

  // 3. All event-level personnel
  const { results: eventPersonnelRows } = await db
    .prepare(
      `SELECT a.role, p.name AS personName, LOWER(p.email) = LOWER(?) AS isMe
       FROM assignments a
       JOIN persons p ON p.id = a.person_id
       WHERE a.type = 'event' AND a.event_id = ?
       ORDER BY a.role ASC`,
    )
    .bind(email, id)
    .all() as { results: { role: string; personName: string; isMe: number }[] }

  // 4. All fights with all assignments
  const { results: fightRows } = await db
    .prepare(
      `SELECT f.id AS fightId, f.order_number AS orderNumber, a.role, p.name AS personName, LOWER(p.email) = LOWER(?) AS isMe
       FROM fights f
       LEFT JOIN assignments a ON a.fight_id = f.id AND a.type = 'fight'
       LEFT JOIN persons p ON p.id = a.person_id
       WHERE f.event_id = ?
       ORDER BY f.order_number ASC, a.role ASC`,
    )
    .bind(email, id)
    .all() as { results: { fightId: string; orderNumber: number; role: string | null; personName: string | null; isMe: number | null }[] }

  // Group fight rows by fight
  const fightsMap = new Map<string, { id: string; orderNumber: number; persons: { role: string; personName: string; isMe: boolean }[] }>()
  for (const row of fightRows) {
    if (!fightsMap.has(row.fightId)) {
      fightsMap.set(row.fightId, { id: row.fightId, orderNumber: row.orderNumber, persons: [] })
    }
    if (row.role && row.personName) {
      fightsMap.get(row.fightId)!.persons.push({ role: row.role, personName: row.personName, isMe: !!row.isMe })
    }
  }

  return {
    ...ev,
    eventPersonnel: eventPersonnelRows.map(r => ({ ...r, isMe: !!r.isMe })),
    fights: Array.from(fightsMap.values()),
  }
})
