import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Unstable_DevWorker } from 'wrangler'
import { startWorker, getSession } from '../../../../test/helpers/server'

describe('Publish guard — POST /api/manager/events/:id/publish', () => {
  let worker: Unstable_DevWorker
  let managerCookie: string
  let adminCookie: string
  let cornerRoleName: string
  let cornerRoleId: string
  let cornerRequirementId: string

  beforeAll(async () => {
    worker = await startWorker()
    managerCookie = await getSession(worker, 'Manager')
    adminCookie = await getSession(worker, 'Admin')

    cornerRoleName = `PublishCornerRole-${Date.now()}`
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
    cornerRequirementId = req.id
  }, 60_000)

  afterAll(async () => {
    await worker.fetch(`/api/admin/dictionaries/requirements/${cornerRequirementId}`, { method: 'DELETE', headers: { Cookie: adminCookie } }).catch(() => {})
    await worker.fetch(`/api/admin/dictionaries/roles/${cornerRoleId}`, { method: 'DELETE', headers: { Cookie: adminCookie } }).catch(() => {})
    await worker.stop()
  })

  async function createEvent(): Promise<string> {
    const res = await worker.fetch('/api/manager/events', {
      method: 'POST',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Gala', date: '2026-09-01', venue: 'Warszawa' }),
    })
    const data = await res.json() as { id: string }
    return data.id
  }

  async function staffFight(eventId: string, fightId: string, excludeRole?: string): Promise<void> {
    const detailRes = await worker.fetch(`/api/manager/events/${eventId}`, { headers: { Cookie: managerCookie } })
    const detail = await detailRes.json() as {
      fights: { id: string; requirements: { role: string; count: number }[] }[]
    }
    const requirements = detail.fights.find(f => f.id === fightId)!.requirements
      .filter(req => req.role !== excludeRole)

    for (const req of requirements) {
      for (let i = 0; i < req.count; i++) {
        const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
        const personRes = await worker.fetch('/api/manager/personnel', {
          method: 'POST',
          headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Test ${req.role} ${suffix}`,
            role: req.role,
            email: `test-staff-${suffix}@test.local`,
            phone: '123456789',
          }),
        })
        const person = await personRes.json() as { id: string }
        await worker.fetch('/api/manager/assignments', {
          method: 'POST',
          headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({ personId: person.id, role: req.role, type: 'fight', fightId }),
        })
      }
    }
  }

  it('returns 422 with error message when event has no fights', async () => {
    const eventId = await createEvent()
    const res = await worker.fetch(`/api/manager/events/${eventId}/publish`, {
      method: 'POST',
      headers: { Cookie: managerCookie },
    })
    expect(res.status).toBe(422)
    const body = await res.json() as { data: { errors: string[] } }
    expect(Array.isArray(body.data.errors)).toBe(true)
    expect(body.data.errors.length).toBeGreaterThan(0)
  })

  it('returns 422 with error message when a required per-fight role (e.g. Ratownik) is missing', async () => {
    const eventId = await createEvent()
    const fightRes = await worker.fetch(`/api/manager/events/${eventId}/fights`, {
      method: 'POST',
      headers: { Cookie: managerCookie },
    })
    const fight = await fightRes.json() as { id: string }
    await staffFight(eventId, fight.id, 'Ratownik')

    const res = await worker.fetch(`/api/manager/events/${eventId}/publish`, {
      method: 'POST',
      headers: { Cookie: managerCookie },
    })
    expect(res.status).toBe(422)
    const body = await res.json() as { data: { errors: string[] } }
    expect(body.data.errors.some(e => /brakuje ratownik/i.test(e))).toBe(true)
  })

  it('returns 422 with a corner-specific message when only one corner of a corner-enabled role is filled', async () => {
    const eventId = await createEvent()
    const fightRes = await worker.fetch(`/api/manager/events/${eventId}/fights`, {
      method: 'POST',
      headers: { Cookie: managerCookie },
    })
    const fight = await fightRes.json() as { id: string }
    await staffFight(eventId, fight.id, cornerRoleName)

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const personRes = await worker.fetch('/api/manager/personnel', {
      method: 'POST',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `Corner Red ${suffix}`, role: cornerRoleName, email: `corner-red-${suffix}@test.local`, phone: '123456789' }),
    })
    const person = await personRes.json() as { id: string }
    await worker.fetch('/api/manager/assignments', {
      method: 'POST',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId: person.id, role: cornerRoleName, type: 'fight', fightId: fight.id, corner: 'red' }),
    })

    const res = await worker.fetch(`/api/manager/events/${eventId}/publish`, {
      method: 'POST',
      headers: { Cookie: managerCookie },
    })
    expect(res.status).toBe(422)
    const body = await res.json() as { data: { errors: string[] } }
    expect(body.data.errors.some(e => e.includes(cornerRoleName) && e.includes('niebieskim'))).toBe(true)
    expect(body.data.errors.some(e => e.includes(cornerRoleName) && e.includes('czerwonym'))).toBe(false)
  })

  it('returns 409 when event is already cancelled', async () => {
    const eventId = await createEvent()
    await worker.fetch(`/api/manager/events/${eventId}/cancel`, {
      method: 'POST',
      headers: { Cookie: managerCookie },
    })
    const res = await worker.fetch(`/api/manager/events/${eventId}/publish`, {
      method: 'POST',
      headers: { Cookie: managerCookie },
    })
    expect(res.status).toBe(409)
  })

  it('returns 404 when event does not exist', async () => {
    const res = await worker.fetch('/api/manager/events/non-existent-id/publish', {
      method: 'POST',
      headers: { Cookie: managerCookie },
    })
    expect(res.status).toBe(404)
  })
})
