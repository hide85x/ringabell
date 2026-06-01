export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  const { name } = await readBody<{ name: string }>(event)

  if (!name || !name.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }

  const db = getD1(event)

  const duplicate = await db.prepare('SELECT id FROM person_roles WHERE name = ? AND id != ? LIMIT 1').bind(name.trim(), id).first()
  if (duplicate) {
    throw createError({ statusCode: 409, statusMessage: 'Role name already exists' })
  }

  const result = await db.prepare('UPDATE person_roles SET name = ? WHERE id = ?').bind(name.trim(), id).run()
  if (result.meta.changes === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Role not found' })
  }
  return { ok: true }
})
