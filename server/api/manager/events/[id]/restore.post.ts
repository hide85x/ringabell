export default defineEventHandler(async (event) => {
  await requireManager(event)
  const id = getRouterParam(event, 'id')
  const db = getD1(event)

  const ev = await db
    .prepare('SELECT id, status FROM events WHERE id = ?')
    .bind(id)
    .first() as { id: string; status: string } | null
  if (!ev) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }
  if (ev.status !== 'cancelled') {
    throw createError({ statusCode: 409, statusMessage: 'Only cancelled events can be restored' })
  }

  await db
    .prepare("UPDATE events SET status = 'draft' WHERE id = ?")
    .bind(id)
    .run()

  return { ok: true }
})
