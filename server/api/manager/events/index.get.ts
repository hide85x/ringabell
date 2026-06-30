export default defineEventHandler(async (event) => {
  await requireManager(event)
  const db = getD1(event)
  const { results } = await db
    .prepare(
      `SELECT e.id, e.name, e.date, e.venue, e.status, e.created_at AS createdAt,
        COUNT(f.id) AS fightCount
       FROM events e
       LEFT JOIN fights f ON f.event_id = e.id
       GROUP BY e.id
       ORDER BY e.date DESC`,
    )
    .all()
  return results
})
