export default defineEventHandler(async (event) => {
  await requireManager(event)
  const id = getRouterParam(event, 'id')
  const db = getD1(event)
  const result = await db
    .prepare('UPDATE persons SET is_active = 0 WHERE id = ?')
    .bind(id)
    .run()
  if (result.meta.changes === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Person not found' })
  }
  return { ok: true }
})
