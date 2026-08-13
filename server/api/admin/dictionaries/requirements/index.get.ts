export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = getD1(event)
  const { results } = await db.prepare(
    `SELECT frd.id, frd.role_id AS roleId, pr.name AS roleName, frd.count, frd.has_corner AS hasCorner
     FROM fight_requirement_defaults frd
     JOIN person_roles pr ON pr.id = frd.role_id
     ORDER BY pr.name ASC`
  ).all()
  return results
})
