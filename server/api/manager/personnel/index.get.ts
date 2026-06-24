export default defineEventHandler(async (event) => {
  await requireManager(event)
  const db = getD1(event)
  const { results } = await db
    .prepare(
      'SELECT id, name, email, phone, role, is_active AS isActive, created_at AS createdAt FROM persons WHERE is_active = 1 ORDER BY name ASC',
    )
    .all()
  return results
})
