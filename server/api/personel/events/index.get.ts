export default defineEventHandler(async (event) => {
  const session = await requirePersonel(event)
  const db = getD1(event)
  const email = session.user.email

  const { results } = await db
    .prepare(
      `SELECT
        e.id, e.name, e.date, e.venue, e.status, e.created_at AS createdAt,
        GROUP_CONCAT(DISTINCT a.role) AS roles
       FROM events e
       JOIN assignments a ON (
         (a.type = 'event' AND a.event_id = e.id)
         OR
         (a.type = 'fight' AND a.fight_id IN (SELECT id FROM fights WHERE event_id = e.id))
       )
       JOIN persons p ON p.id = a.person_id
       WHERE p.email = ? AND e.status = 'published'
       GROUP BY e.id
       ORDER BY e.date ASC`,
    )
    .bind(email)
    .all() as { results: { id: string; name: string; date: string; venue: string; status: string; createdAt: string; roles: string | null }[] }

  return results.map(row => ({
    ...row,
    roles: row.roles ? row.roles.split(',') : [],
  }))
})
