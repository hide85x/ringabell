export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = getD1(event)
  const { results } = await db.prepare(
    `SELECT erd.id, erd.role_id AS roleId, pr.name AS roleName, erd.count
     FROM event_requirement_defaults erd
     JOIN person_roles pr ON pr.id = erd.role_id
     ORDER BY pr.name ASC`
  ).all()
  return results
})
