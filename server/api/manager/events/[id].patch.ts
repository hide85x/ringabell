export default defineEventHandler(async (event) => {
  await requireManager(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody<{ name?: string; date?: string; venue?: string }>(event)

  const db = getD1(event)
  const ev = await db
    .prepare('SELECT status FROM events WHERE id = ?')
    .bind(id)
    .first() as { status: string } | null
  if (!ev) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }
  if (ev.status !== 'draft') {
    throw createError({ statusCode: 409, statusMessage: 'Only draft events can be edited' })
  }

  const sets: string[] = []
  const vals: unknown[] = []

  if (body?.name !== undefined) {
    if (!body.name?.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'name cannot be empty' })
    }
    sets.push('name = ?')
    vals.push(body.name.trim())
  }
  if (body?.date !== undefined) {
    if (!body.date?.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'date cannot be empty' })
    }
    sets.push('date = ?')
    vals.push(body.date.trim())
  }
  if (body?.venue !== undefined) {
    if (!body.venue?.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'venue cannot be empty' })
    }
    sets.push('venue = ?')
    vals.push(body.venue.trim())
  }

  if (sets.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  vals.push(id)
  const result = await db
    .prepare(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...vals)
    .run()

  if (result.meta.changes === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }
  return { ok: true }
})
