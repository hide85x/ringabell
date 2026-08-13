import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Unstable_DevWorker } from 'wrangler'
import { startWorker, getSession } from '../../../../test/helpers/server'

const BOKSER_PERSON_ID = 'test-personel-001'

describe('Backend guard — bokser nie może walczyć dwa razy na tej samej gali', () => {
  let worker: Unstable_DevWorker
  let managerCookie: string

  beforeAll(async () => {
    worker = await startWorker()
    managerCookie = await getSession(worker, 'Manager')
  }, 60_000)

  afterAll(async () => {
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

  async function addFight(eventId: string): Promise<string> {
    const res = await worker.fetch(`/api/manager/events/${eventId}/fights`, {
      method: 'POST',
      headers: { Cookie: managerCookie },
    })
    const data = await res.json() as { id: string }
    return data.id
  }

  it('returns 409 when assigning the same bokser to a second fight of the same event', async () => {
    const eventId = await createEvent()
    const fight1 = await addFight(eventId)
    const fight2 = await addFight(eventId)

    const first = await worker.fetch('/api/manager/assignments', {
      method: 'POST',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId: BOKSER_PERSON_ID, role: 'Bokser', type: 'fight', fightId: fight1 }),
    })
    expect(first.status).toBe(201)

    const second = await worker.fetch('/api/manager/assignments', {
      method: 'POST',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId: BOKSER_PERSON_ID, role: 'Bokser', type: 'fight', fightId: fight2 }),
    })
    expect(second.status).toBe(409)
  })

  it('blocks the conflict regardless of role name casing', async () => {
    const eventId = await createEvent()
    const fight1 = await addFight(eventId)
    const fight2 = await addFight(eventId)

    await worker.fetch('/api/manager/assignments', {
      method: 'POST',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId: BOKSER_PERSON_ID, role: 'bokser', type: 'fight', fightId: fight1 }),
    })

    const second = await worker.fetch('/api/manager/assignments', {
      method: 'POST',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId: BOKSER_PERSON_ID, role: 'BOKSER', type: 'fight', fightId: fight2 }),
    })
    expect(second.status).toBe(409)
  })

  it('does not block the same bokser fighting in a different event', async () => {
    const eventA = await createEvent()
    const fightA = await addFight(eventA)
    const eventB = await createEvent()
    const fightB = await addFight(eventB)

    const first = await worker.fetch('/api/manager/assignments', {
      method: 'POST',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId: BOKSER_PERSON_ID, role: 'Bokser', type: 'fight', fightId: fightA }),
    })
    expect(first.status).toBe(201)

    const second = await worker.fetch('/api/manager/assignments', {
      method: 'POST',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId: BOKSER_PERSON_ID, role: 'Bokser', type: 'fight', fightId: fightB }),
    })
    expect(second.status).toBe(201)
  })
})
