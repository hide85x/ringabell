export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  const db = getD1(event)

  const target = await db
    .prepare('SELECT role, email FROM users WHERE id = ?')
    .bind(id)
    .first() as { role: string; email: string } | null
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }
  if (target.email === PROTECTED_ADMIN_EMAIL) {
    throw createError({ statusCode: 403, statusMessage: 'This account cannot be deleted' })
  }
  if (target.role === 'Admin') {
    const row = await db
      .prepare("SELECT COUNT(*) as count FROM users WHERE role = 'Admin'")
      .first() as { count: number } | null
    if ((row?.count ?? 0) <= 1) {
      throw createError({ statusCode: 409, statusMessage: 'Cannot delete the last Admin' })
    }
  }

  await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
  return { ok: true }
})
