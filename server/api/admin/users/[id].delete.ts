export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  const db = getD1(event)
  const result = await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
  if (result.meta.changes === 0) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }
  return { ok: true }
})
