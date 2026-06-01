import { nowUtc } from '~~/utils/date'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { name } = await readBody<{ name: string }>(event)

  if (!name || !name.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }

  const db = getD1(event)

  const existing = await db.prepare('SELECT id FROM person_roles WHERE name = ? LIMIT 1').bind(name.trim()).first()
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Role already exists' })
  }

  const id = crypto.randomUUID()
  await db.prepare(
    'INSERT INTO person_roles (id, name, created_at) VALUES (?, ?, ?)'
  ).bind(id, name.trim(), nowUtc()).run()

  setResponseStatus(event, 201)
  return { ok: true, id }
})
