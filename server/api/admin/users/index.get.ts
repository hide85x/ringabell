export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = getD1(event)
  const { results } = await db.prepare(
    'SELECT id, email, name, avatar, role, created_at AS createdAt FROM users ORDER BY created_at DESC'
  ).all()
  return results
})
