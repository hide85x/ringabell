export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  const { count } = await readBody<{ count: number }>(event)

  if (!count || count < 1 || !Number.isInteger(count)) {
    throw createError({ statusCode: 400, statusMessage: 'count must be a positive integer' })
  }

  const db = getD1(event)
  const result = await db.prepare('UPDATE event_requirement_defaults SET count = ? WHERE id = ?').bind(count, id).run()
  if (result.meta.changes === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Requirement not found' })
  }
  return { ok: true }
})
