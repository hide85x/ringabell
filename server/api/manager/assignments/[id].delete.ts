export default defineEventHandler(async (event) => {
  await requireManager(event)
  const id = getRouterParam(event, 'id')
  const db = getD1(event)

  const existing = await db
    .prepare('SELECT id FROM assignments WHERE id = ?')
    .bind(id)
    .first()
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Assignment not found' })
  }

  await db.prepare('DELETE FROM assignments WHERE id = ?').bind(id).run()

  return { ok: true }
})
