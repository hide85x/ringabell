export default defineEventHandler(async (event) => {
  await requireManager(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody<{
    name?: string
    email?: string | null
    phone?: string | null
    role?: string
    is_active?: number
  }>(event)

  const db = getD1(event)
  const sets: string[] = []
  const vals: unknown[] = []

  if (body?.name !== undefined) {
    if (!body.name?.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'name cannot be empty' })
    }
    sets.push('name = ?')
    vals.push(body.name.trim())
  }
  if (body?.email !== undefined) {
    if (body.email?.trim() && !body.email.includes('@')) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid email' })
    }
    sets.push('email = ?')
    vals.push(body.email?.trim() ?? null)
  }
  if (body?.phone !== undefined) {
    if (body.phone?.trim() && !/^[\d\s()\-+]{7,}$/.test(body.phone.trim())) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid phone number' })
    }
    sets.push('phone = ?')
    vals.push(body.phone?.trim() ?? null)
  }
  if (body?.role !== undefined) {
    const roleRow = await db
      .prepare('SELECT id FROM person_roles WHERE name = ?')
      .bind(body.role)
      .first()
    if (!roleRow) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid role' })
    }
    sets.push('role = ?')
    vals.push(body.role)
  }
  if (body?.is_active !== undefined) {
    if (body.is_active !== 0 && body.is_active !== 1) {
      throw createError({ statusCode: 400, statusMessage: 'is_active must be 0 or 1' })
    }
    sets.push('is_active = ?')
    vals.push(body.is_active)
  }

  if (sets.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  vals.push(id)
  const result = await db
    .prepare(`UPDATE persons SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...vals)
    .run()

  if (result.meta.changes === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Person not found' })
  }
  return { ok: true }
})
