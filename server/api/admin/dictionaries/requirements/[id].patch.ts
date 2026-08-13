export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  const { count, hasCorner } = await readBody<{ count: number; hasCorner?: boolean }>(event)

  if (!count || count < 1 || !Number.isInteger(count)) {
    throw createError({ statusCode: 400, statusMessage: 'count must be a positive integer' })
  }

  const db = getD1(event)

  const existing = await db.prepare('SELECT has_corner AS hasCorner FROM fight_requirement_defaults WHERE id = ?').bind(id).first() as { hasCorner: number } | null
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Requirement not found' })
  }
  const finalHasCorner = hasCorner ?? !!existing.hasCorner
  if (finalHasCorner && count % 2 !== 0) {
    throw createError({ statusCode: 400, statusMessage: 'count must be even when hasCorner is enabled' })
  }

  const result = await db.prepare('UPDATE fight_requirement_defaults SET count = ?, has_corner = ? WHERE id = ?').bind(count, finalHasCorner ? 1 : 0, id).run()
  if (result.meta.changes === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Requirement not found' })
  }
  return { ok: true }
})
