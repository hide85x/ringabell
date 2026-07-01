export default defineEventHandler(async (event) => {
  await requireManager(event)
  const id = getRouterParam(event, 'id')
  const db = getD1(event)

  const ev = await db
    .prepare('SELECT status FROM events WHERE id = ?')
    .bind(id)
    .first() as { status: string } | null
  if (!ev) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }
  if (ev.status === 'cancelled') {
    throw createError({ statusCode: 409, statusMessage: 'Event is already cancelled' })
  }

  await db.prepare(`UPDATE events SET status = 'cancelled' WHERE id = ?`).bind(id).run()
  return { ok: true }
})
