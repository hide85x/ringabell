import { unstable_dev } from 'wrangler'
import type { UnstableDevWorker } from 'wrangler'

export const TEST_USER_ID = 'test-user-001'

export async function startWorker(): Promise<UnstableDevWorker> {
  return unstable_dev('.output/server/index.mjs', {
    experimental: { disableExperimentalWarning: true },
    local: true,
    logLevel: 'error',
    vars: {
      NUXT_SESSION_PASSWORD: 'test-session-password-must-be-32-chars!!',
      NUXT_TEST_MODE: '1',
    },
  })
}

export async function getSession(worker: UnstableDevWorker, role: string): Promise<string> {
  const res = await worker.fetch('/test-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })
  const cookie = res.headers.get('set-cookie')
  if (!cookie) throw new Error(`No session cookie for role ${role}`)
  return cookie
}
