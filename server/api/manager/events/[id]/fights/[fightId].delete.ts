export default defineEventHandler(async (event) => {
  await requireManager(event)
  const eventId = getRouterParam(event, 'id')
  const fightId = getRouterParam(event, 'fightId')
  const db = getD1(event)

  const fight = await db
    .prepare(
      `SELECT f.id, e.status
       FROM fights f
       JOIN events e ON e.id = f.event_id
       WHERE f.id = ? AND f.event_id = ?`,
    )
    .bind(fightId, eventId)
    .first() as { id: string; status: string } | null
  if (!fight) {
    throw createError({ statusCode: 404, statusMessage: 'Fight not found' })
  }
  if (fight.status !== 'draft') {
    throw createError({ statusCode: 409, statusMessage: 'Event is not a draft' })
  }

  await db.prepare('DELETE FROM fights WHERE id = ?').bind(fightId).run()

  return { ok: true }
})
