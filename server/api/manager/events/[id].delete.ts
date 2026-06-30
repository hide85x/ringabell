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
  if (ev.status !== 'draft') {
    throw createError({ statusCode: 409, statusMessage: 'Only draft events can be deleted' })
  }

  await db.prepare('DELETE FROM events WHERE id = ?').bind(id).run()
  return { ok: true }
})
