export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { roleId, count } = await readBody<{ roleId: string; count: number }>(event)

  if (!roleId) {
    throw createError({ statusCode: 400, statusMessage: 'roleId is required' })
  }
  if (!count || count < 1 || !Number.isInteger(count)) {
    throw createError({ statusCode: 400, statusMessage: 'count must be a positive integer' })
  }

  const db = getD1(event)

  const role = await db.prepare('SELECT id FROM person_roles WHERE id = ? LIMIT 1').bind(roleId).first()
  if (!role) {
    throw createError({ statusCode: 404, statusMessage: 'Role not found' })
  }

  const existing = await db.prepare('SELECT id FROM event_requirement_defaults WHERE role_id = ? LIMIT 1').bind(roleId).first()
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Requirement for this role already exists' })
  }

  const id = crypto.randomUUID()
  await db.prepare(
    'INSERT INTO event_requirement_defaults (id, role_id, count) VALUES (?, ?, ?)'
  ).bind(id, roleId, count).run()

  setResponseStatus(event, 201)
  return { ok: true, id }
})
