import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Unstable_DevWorker } from 'wrangler'
import { startWorker, getSession, TEST_USER_ID } from '../../../../test/helpers/server'

describe('Input validation — /api/admin/users', () => {
  let worker: Unstable_DevWorker
  let adminCookie: string

  beforeAll(async () => {
    worker = await startWorker()
    adminCookie = await getSession(worker, 'Admin')
  }, 60_000)

  afterAll(async () => {
    await worker.stop()
  })

  it('PATCH returns 400 for invalid role', async () => {
    const res = await worker.fetch(`/api/admin/users/${TEST_USER_ID}`, {
      method: 'PATCH',
      headers: {
        Cookie: adminCookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'INVALID_ROLE' }),
    })
    expect(res.status).toBe(400)
  })

  it('POST returns 400 for invalid email', async () => {
    const res = await worker.fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        Cookie: adminCookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'notanemail', role: 'Admin' }),
    })
    expect(res.status).toBe(400)
  })
})
