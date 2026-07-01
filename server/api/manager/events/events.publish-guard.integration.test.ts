import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Unstable_DevWorker } from 'wrangler'
import { startWorker, getSession } from '../../../../test/helpers/server'

describe('Publish guard — POST /api/manager/events/:id/publish', () => {
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
