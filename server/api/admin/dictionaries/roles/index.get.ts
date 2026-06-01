export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = getD1(event)
  const { results } = await db.prepare(
    'SELECT id, name, created_at AS createdAt FROM person_roles ORDER BY name ASC'
  ).all()
  return results
})
