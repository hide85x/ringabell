import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Unstable_DevWorker } from 'wrangler'
import { startWorker, getSession } from '../../../../test/helpers/server'

describe('Corner assignment validation — POST /api/manager/assignments', () => {
  let worker: Unstable_DevWorker
  let managerCookie: string
  let adminCookie: string
  let cornerRoleName: string
  let cornerRoleId: string
  let requirementId: string

  beforeAll(async () => {
    worker = await startWorker()
    managerCookie = await getSession(worker, 'Manager')
    adminCookie = await getSession(worker, 'Admin')

    cornerRoleName = `AssignCornerRole-${Date.now()}`
    const roleRes = await worker.fetch('/api/admin/dictionaries/roles', {
      method: 'POST',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: cornerRoleName }),
    })
    const role = await roleRes.json() as { id: string }
    cornerRoleId = role.id
    const reqRes = await worker.fetch('/api/admin/dictionaries/requirements', {
      method: 'POST',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId: cornerRoleId, count: 2, hasCorner: true }),
    })
    const req = await reqRes.json() as { id: string }
    requirementId = req.id
  }, 60_000)

  afterAll(async () => {
    await worker.fetch(`/api/admin/dictionaries/requirements/${requirementId}`, { method: 'DELETE', headers: { Cookie: adminCookie } }).catch(() => {})
    await worker.fetch(`/api/admin/dictionaries/roles/${cornerRoleId}`, { method: 'DELETE', headers: { Cookie: adminCookie } }).catch(() => {})
    await worker.stop()
  })

  async function createEventWithFight(): Promise<{ eventId: string; fightId: string }> {
    const evRes = await worker.fetch('/api/manager/events', {
      method: 'POST',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Corner Assignment Test', date: '2026-09-20', venue: 'Warszawa' }),
    })
    const ev = await evRes.json() as { id: string }
    const fightRes = await worker.fetch(`/api/manager/events/${ev.id}/fights`, { method: 'POST', headers: { Cookie: managerCookie } })
    const fight = await fightRes.json() as { id: string }
    return { eventId: ev.id, fightId: fight.id }
  }

  async function makePerson(role: string, suffix: string): Promise<string> {
    const res = await worker.fetch('/api/manager/personnel', {
      method: 'POST',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `CornerAssignPerson${suffix}`, role, email: `corner-assign-${suffix}-${Date.now()}@test.local`, phone: '123456789' }),
    })
    const person = await res.json() as { id: string }
    return person.id
  }

  it('returns 400 when corner is missing for a corner-enabled role', async () => {
    const { fightId } = await createEventWithFight()
    const personId = await makePerson(cornerRoleName, 'A')
    const res = await worker.fetch('/api/manager/assignments', {
      method: 'POST',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId, role: cornerRoleName, type: 'fight', fightId }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when corner is set for a role without a corner', async () => {
    const { fightId } = await createEventWithFight()
    const personId = await makePerson('Bokser', 'B')
    const res = await worker.fetch('/api/manager/assignments', {
      method: 'POST',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId, role: 'Bokser', type: 'fight', fightId, corner: 'red' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 201 with a valid corner for a corner-enabled role', async () => {
    const { fightId } = await createEventWithFight()
    const personId = await makePerson(cornerRoleName, 'C')
    const res = await worker.fetch('/api/manager/assignments', {
      method: 'POST',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId, role: cornerRoleName, type: 'fight', fightId, corner: 'red' }),
    })
    expect(res.status).toBe(201)
  })

  it('returns 409 when the same person is assigned to both corners for the same role/fight', async () => {
    const { fightId } = await createEventWithFight()
    const personId = await makePerson(cornerRoleName, 'D')
    const first = await worker.fetch('/api/manager/assignments', {
      method: 'POST',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId, role: cornerRoleName, type: 'fight', fightId, corner: 'red' }),
    })
    expect(first.status).toBe(201)
    const second = await worker.fetch('/api/manager/assignments', {
      method: 'POST',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId, role: cornerRoleName, type: 'fight', fightId, corner: 'blue' }),
    })
    expect(second.status).toBe(409)
  })
})
