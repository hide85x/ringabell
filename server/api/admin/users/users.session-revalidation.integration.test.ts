import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Unstable_DevWorker } from 'wrangler'
import { startWorker, getSession } from '../../../../test/helpers/server'

async function createThrowawayUser(worker: Unstable_DevWorker, adminCookie: string, email: string, role: string): Promise<string> {
  // Self-cleaning: remove any leftover row from a previous run (e.g. re-running
  // this file without `npm run test:seed` in between) so the test starts from a
  // known state regardless of what an earlier invocation mutated.
  const existing = await worker.fetch('/api/admin/users', { headers: { Cookie: adminCookie } })
  const existingUsers = await existing.json() as { id: string; email: string }[]
  const stale = existingUsers.find(u => u.email === email)
  if (stale) {
    await worker.fetch(`/api/admin/users/${stale.id}`, { method: 'DELETE', headers: { Cookie: adminCookie } })
  }

  await worker.fetch('/api/admin/users', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role }),
  })
  const res = await worker.fetch('/api/admin/users', { headers: { Cookie: adminCookie } })
  const users = await res.json() as { id: string; email: string }[]
  return users.find(u => u.email === email)!.id
}

describe('Session revalidation — active sessions rejected after DB change', () => {
  let worker: Unstable_DevWorker
  let adminCookie: string

  beforeAll(async () => {
    worker = await startWorker()
    adminCookie = await getSession(worker, 'Admin')
  }, 60_000)

  afterAll(async () => {
    await worker.stop()
  })

  it('rejects an active session after its user account is deleted', async () => {
    const email = 'test-revalidation-delete@test.local'
    const userId = await createThrowawayUser(worker, adminCookie, email, 'Manager')
    const managerCookie = await getSession(worker, 'Manager', email)

    const before = await worker.fetch('/api/manager/personnel', {
      headers: { Cookie: managerCookie },
    })
    expect(before.status).toBe(200)

    await worker.fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    })

    const after = await worker.fetch('/api/manager/personnel', {
      headers: { Cookie: managerCookie },
    })
    expect(after.status).toBe(401)
  })

  it('rejects an active session after its role is changed', async () => {
    const email = 'test-revalidation-rolechange@test.local'
    const userId = await createThrowawayUser(worker, adminCookie, email, 'Manager')
    const managerCookie = await getSession(worker, 'Manager', email)

    const before = await worker.fetch('/api/manager/personnel', {
      headers: { Cookie: managerCookie },
    })
    expect(before.status).toBe(200)

    await worker.fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'Personel' }),
    })

    const after = await worker.fetch('/api/manager/personnel', {
      headers: { Cookie: managerCookie },
    })
    expect(after.status).toBe(401)
  })
})
