import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Unstable_DevWorker } from 'wrangler'
import { startWorker, getSession } from '../../../../test/helpers/server'

describe('Input validation — /api/manager/personnel', () => {
  let worker: Unstable_DevWorker
  let managerCookie: string

  beforeAll(async () => {
    worker = await startWorker()
    managerCookie = await getSession(worker, 'Manager')
  }, 60_000)

  afterAll(async () => {
    await worker.stop()
  })

  it('POST returns 400 when name is missing', async () => {
    const res = await worker.fetch('/api/manager/personnel', {
      method: 'POST',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'Bokser' }),
    })
    expect(res.status).toBe(400)
  })

  it('POST returns 400 when role is missing', async () => {
    const res = await worker.fetch('/api/manager/personnel', {
      method: 'POST',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Jan Kowalski' }),
    })
    expect(res.status).toBe(400)
  })

  it('POST returns 400 when role does not exist in person_roles', async () => {
    const res = await worker.fetch('/api/manager/personnel', {
      method: 'POST',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Jan Kowalski', role: 'NIEISTNIEJACA_ROLA' }),
    })
    expect(res.status).toBe(400)
  })

  it('PATCH returns 400 when body is empty', async () => {
    const res = await worker.fetch('/api/manager/personnel/some-id', {
      method: 'PATCH',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('PATCH returns 400 when is_active is invalid', async () => {
    const res = await worker.fetch('/api/manager/personnel/some-id', {
      method: 'PATCH',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: 2 }),
    })
    expect(res.status).toBe(400)
  })

  it('PATCH returns 404 for non-existent person', async () => {
    const res = await worker.fetch('/api/manager/personnel/non-existent-id', {
      method: 'PATCH',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nowe Imię' }),
    })
    expect(res.status).toBe(404)
  })

  it('DELETE returns 404 for non-existent person', async () => {
    const res = await worker.fetch('/api/manager/personnel/non-existent-id', {
      method: 'DELETE',
      headers: { Cookie: managerCookie },
    })
    expect(res.status).toBe(404)
  })
})
