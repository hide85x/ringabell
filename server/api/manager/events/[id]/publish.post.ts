export default defineEventHandler(async (event) => {
  await requireManager(event)
  const id = getRouterParam(event, 'id')
  const db = getD1(event)

  const ev = await db
    .prepare('SELECT id, date, status FROM events WHERE id = ?')
    .bind(id)
    .first() as { id: string; date: string; status: string } | null
  if (!ev) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }
  if (ev.status !== 'draft') {
    throw createError({ statusCode: 409, statusMessage: 'Only draft events can be published' })
  }

  const errors: string[] = []

  // 1. At least one fight
  const fightCountRow = await db
    .prepare('SELECT COUNT(*) AS count FROM fights WHERE event_id = ?')
    .bind(id)
    .first() as { count: number } | null
  const fightCount = fightCountRow?.count ?? 0
  if (fightCount === 0) {
    errors.push('Gala musi mieć co najmniej jedną walkę')
  }

  // 2. Per-fight: all required roles filled
  if (fightCount > 0) {
    const { results: fights } = await db
      .prepare('SELECT id FROM fights WHERE event_id = ?')
      .bind(id)
      .all() as { results: { id: string }[] }

    for (const fight of fights) {
      const { results: reqs } = await db
        .prepare('SELECT role, count, has_corner AS hasCorner FROM fight_requirements WHERE fight_id = ?')
        .bind(fight.id)
        .all() as { results: { role: string; count: number; hasCorner: number }[] }

      for (const req of reqs) {
        if (req.hasCorner) {
          const perCorner = req.count / 2
          for (const corner of ['red', 'blue'] as const) {
            const row = await db
              .prepare('SELECT COUNT(*) AS count FROM assignments WHERE fight_id = ? AND role = ? AND corner = ?')
              .bind(fight.id, req.role, corner)
              .first() as { count: number } | null
            const assigned = row?.count ?? 0
            if (assigned < perCorner) {
              const cornerLabel = corner === 'red' ? 'czerwonym' : 'niebieskim'
              errors.push(`Walka #${fights.indexOf(fight) + 1}: brakuje ${req.role} w ${cornerLabel} narożniku (${assigned}/${perCorner})`)
            }
          }
        }
        else {
          const row = await db
            .prepare('SELECT COUNT(*) AS count FROM assignments WHERE fight_id = ? AND role = ?')
            .bind(fight.id, req.role)
            .first() as { count: number } | null
          const assigned = row?.count ?? 0
          if (assigned < req.count) {
            errors.push(`Walka #${fights.indexOf(fight) + 1}: brakuje ${req.role} (${assigned}/${req.count})`)
          }
        }
      }
    }
  }

  // 3. Date conflicts — two separate queries to avoid UNION issues in D1
  const { results: fightConflicts } = await db
    .prepare(
      `SELECT DISTINCT a.person_id AS personId, p.name AS personName
       FROM assignments a
       JOIN persons p ON p.id = a.person_id
       JOIN fights f ON f.id = a.fight_id
       JOIN events e ON e.id = f.event_id
       WHERE e.date = ? AND e.id != ? AND e.status != 'cancelled'`,
    )
    .bind(ev.date, id)
    .all() as { results: { personId: string; personName: string }[] }

  const { results: eventConflicts } = await db
    .prepare(
      `SELECT DISTINCT a.person_id AS personId, p.name AS personName
       FROM assignments a
       JOIN persons p ON p.id = a.person_id
       JOIN events e ON e.id = a.event_id
       WHERE e.date = ? AND e.id != ? AND e.status != 'cancelled'`,
    )
    .bind(ev.date, id)
    .all() as { results: { personId: string; personName: string }[] }

  const conflictMap = new Map<string, string>()
  for (const r of [...fightConflicts, ...eventConflicts]) {
    conflictMap.set(r.personId, r.personName)
  }

  if (conflictMap.size > 0) {
    // Only flag conflicts for persons actually in this event
    const { results: thisEventPersons } = await db
      .prepare(
        `SELECT DISTINCT a.person_id AS personId FROM assignments a
         WHERE a.event_id = ? OR a.fight_id IN (SELECT id FROM fights WHERE event_id = ?)`,
      )
      .bind(id, id)
      .all() as { results: { personId: string }[] }

    const thisEventSet = new Set(thisEventPersons.map(r => r.personId))
    for (const [personId, personName] of conflictMap) {
      if (thisEventSet.has(personId)) {
        errors.push(`Konflikt dat: ${personName} jest przypisany do innej gali w tym dniu`)
      }
    }
  }

  if (errors.length > 0) {
    throw createError({ statusCode: 422, statusMessage: 'Validation failed', data: { errors } })
  }

  await db.prepare(`UPDATE events SET status = 'published' WHERE id = ?`).bind(id).run()
  return { ok: true }
})
