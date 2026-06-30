import { nowUtc } from '~~/utils/date'

export default defineEventHandler(async (event) => {
  await requireManager(event)
  const body = await readBody<{ name?: string; email?: string; phone?: string; role?: string }>(event)

  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }
  if (!body?.role?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'role is required' })
  }

  if (!body?.email?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'email is required' })
  }
  if (!body.email.includes('@')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid email' })
  }
  if (!body?.phone?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'phone is required' })
  }
  if (!/^[\d\s()\-+]{7,}$/.test(body.phone.trim())) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid phone number' })
  }

  const db = getD1(event)
  const roleRow = await db
    .prepare('SELECT id FROM person_roles WHERE name = ?')
    .bind(body.role)
    .first()
  if (!roleRow) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid role' })
  }

  const id = crypto.randomUUID()
  await db
    .prepare(
      'INSERT INTO persons (id, name, email, phone, role, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
    )
    .bind(id, body.name.trim(), body.email?.trim() ?? null, body.phone?.trim() ?? null, body.role, nowUtc())
    .run()

  setResponseStatus(event, 201)
  return { ok: true, id }
})
