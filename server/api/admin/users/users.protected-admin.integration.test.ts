import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Unstable_DevWorker } from 'wrangler'
import { startWorker, getSession } from '../../../../test/helpers/server'

const PROTECTED_EMAIL = 'lukasz.pelc@profitroom.com'

describe('Protected admin account — /api/admin/users/[id]', () => {
  let worker: Unstable_DevWorker
  let adminCookie: string
  let protectedUserId: string

  beforeAll(async () => {
    worker = await startWorker()
    adminCookie = await getSession(worker, 'Admin')

    await worker.fetch('/api/admin/users', {
      method: 'POST',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: PROTECTED_EMAIL, role: 'Admin' }),
    })
    const res = await worker.fetch('/api/admin/users', { headers: { Cookie: adminCookie } })
    const users = await res.json() as { id: string; email: string }[]
    protectedUserId = users.find(u => u.email === PROTECTED_EMAIL)!.id
  }, 60_000)

  afterAll(async () => {
    await worker.stop()
  })

  it('DELETE returns 403 for the protected account', async () => {
    const res = await worker.fetch(`/api/admin/users/${protectedUserId}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    })
    expect(res.status).toBe(403)
  })

  it('PATCH returns 403 when changing the protected account away from Admin', async () => {
    const res = await worker.fetch(`/api/admin/users/${protectedUserId}`, {
      method: 'PATCH',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'Manager' }),
    })
    expect(res.status).toBe(403)
  })

  it('PATCH allows setting the protected account role to Admin (no-op)', async () => {
    const res = await worker.fetch(`/api/admin/users/${protectedUserId}`, {
      method: 'PATCH',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'Admin' }),
    })
    expect(res.status).toBe(200)
  })
})
