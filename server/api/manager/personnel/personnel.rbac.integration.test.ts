import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Unstable_DevWorker } from 'wrangler'
import { startWorker, getSession } from '../../../../test/helpers/server'

describe('RBAC — GET /api/manager/personnel', () => {
  let worker: Unstable_DevWorker

  beforeAll(async () => {
    worker = await startWorker()
  }, 60_000)

  afterAll(async () => {
    await worker.stop()
  })

  it('returns 401 when no session cookie is present', async () => {
    const res = await worker.fetch('/api/manager/personnel')
    expect(res.status).toBe(401)
  })

  it('returns 403 when session role is Personel', async () => {
    const cookie = await getSession(worker, 'Personel')
    const res = await worker.fetch('/api/manager/personnel', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(403)
  })

  it('returns 200 when session role is Manager', async () => {
    const cookie = await getSession(worker, 'Manager')
    const res = await worker.fetch('/api/manager/personnel', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
  })

  it('returns 200 when session role is Admin', async () => {
    const cookie = await getSession(worker, 'Admin')
    const res = await worker.fetch('/api/manager/personnel', {
      headers: { Cookie: cookie },
    })
    expect(res.status).toBe(200)
  })
})
