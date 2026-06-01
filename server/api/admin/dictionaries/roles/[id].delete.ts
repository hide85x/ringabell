export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  const db = getD1(event)

  const role = await db.prepare('SELECT name FROM person_roles WHERE id = ? LIMIT 1').bind(id).first() as { name: string } | null
  if (!role) {
    throw createError({ statusCode: 404, statusMessage: 'Role not found' })
  }

  const used = await db.prepare('SELECT id FROM persons WHERE role = ? LIMIT 1').bind(role.name).first()
  if (used) {
    throw createError({ statusCode: 409, statusMessage: 'Role is in use — remove persons with this role first' })
  }

  await db.prepare('DELETE FROM person_roles WHERE id = ?').bind(id).run()
  return { ok: true }
})
