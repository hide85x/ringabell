export default defineEventHandler(async (event) => {
  await requireManager(event)
  const id = getRouterParam(event, 'id')
  const db = getD1(event)

  const ev = await db
    .prepare('SELECT status FROM events WHERE id = ?')
    .bind(id)
    .first() as { status: string } | null
  if (!ev) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }
  if (ev.status !== 'draft' && ev.status !== 'cancelled') {
    throw createError({ statusCode: 409, statusMessage: 'Only draft or cancelled events can be deleted' })
  }

  // Delete event-level assignments (no CASCADE on event_id)
  await db.prepare("DELETE FROM assignments WHERE event_id = ?").bind(id).run()

  // Delete fight-level assignments (no CASCADE on fight_id)
  await db
    .prepare('DELETE FROM assignments WHERE fight_id IN (SELECT id FROM fights WHERE event_id = ?)')
    .bind(id)
    .run()

  await db.prepare('DELETE FROM events WHERE id = ?').bind(id).run()
  return { ok: true }
})
