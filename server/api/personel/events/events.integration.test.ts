import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Unstable_DevWorker } from 'wrangler'
import { startWorker, getSession } from '../../../../test/helpers/server'

interface EventItem {
  id: string
  name: string
  date: string
  venue: string
  status: string
  createdAt: string
  roles: string[]
}

describe('Integration — /api/personel/events', () => {
  let worker: Unstable_DevWorker
  let personelCookie: string

  beforeAll(async () => {
    worker = await startWorker()
    personelCookie = await getSession(worker, 'Personel')
  }, 60_000)

  afterAll(async () => {
    await worker.stop()
  })

  it('returns [] for a Personel session without a matching Person record', async () => {
    const cookie = await getSession(worker, 'Personel', 'test-personel-empty@test.local')
    const res = await worker.fetch('/api/personel/events', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('returns the published event with roles for an assigned Personel', async () => {
    const res = await worker.fetch('/api/personel/events', {
      headers: { Cookie: personelCookie },
    })
    expect(res.status).toBe(200)
    const events = await res.json() as EventItem[]
    const ev = events.find(e => e.id === 'test-event-personel-pub')
    expect(ev).toBeTruthy()
    expect(ev!.roles.sort()).toEqual(['Ratownik', 'Sędzia'])
  })

  it('does not return draft events', async () => {
    const res = await worker.fetch('/api/personel/events', {
      headers: { Cookie: personelCookie },
    })
    const events = await res.json() as EventItem[]
    expect(events.find(e => e.id === 'test-event-personel-draft')).toBeUndefined()
  })

  it('returns detail for an event the person is assigned to', async () => {
    const res = await worker.fetch('/api/personel/events/test-event-personel-pub', {
      headers: { Cookie: personelCookie },
    })
    expect(res.status).toBe(200)
    const detail = await res.json() as {
      eventPersonnel: { role: string; personName: string; isMe: boolean }[]
      fights: { orderNumber: number; persons: { role: string; personName: string; isMe: boolean }[] }[]
    }
    expect(detail.eventPersonnel.some(p => p.role === 'Ratownik' && p.isMe)).toBe(true)
    expect(detail.fights).toHaveLength(1)
    expect(detail.fights[0]!.persons.some(p => p.role === 'Sędzia' && p.isMe)).toBe(true)
  })

  it('returns 404 for an event the person is not assigned to', async () => {
    const res = await worker.fetch('/api/personel/events/test-event-personel-other', {
      headers: { Cookie: personelCookie },
    })
    expect(res.status).toBe(404)
  })
})
