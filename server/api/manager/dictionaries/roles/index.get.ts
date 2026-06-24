export default defineEventHandler(async (event) => {
  await requireManager(event)
  const db = getD1(event)
  const { results } = await db
    .prepare('SELECT id, name FROM person_roles ORDER BY name ASC')
    .all()
  return results
})
