const VALID_ROLES = ['Admin', 'Manager', 'Personel'] as const

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  const { role } = await readBody<{ role: string }>(event)

  if (!VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid role' })
  }

  const db = getD1(event)
  const result = await db.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, id).run()
  if (result.meta.changes === 0) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }
  return { ok: true }
})
