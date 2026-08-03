import type { H3Event } from 'h3'
import type { UserSession } from '#auth-utils'

async function lookupRole(db: ReturnType<typeof getD1>, email: string): Promise<{ role: string } | null> {
  return await db
    .prepare('SELECT role FROM users WHERE LOWER(email) = LOWER(?)')
    .bind(email)
    .first() as { role: string } | null
}

export async function isSessionValid(session: UserSession, event: H3Event): Promise<boolean> {
  if (!session.user?.email || !session.user?.role) return false
  const db = getD1(event)
  let row: { role: string } | null
  try {
    row = await lookupRole(db, session.user.email)
  }
  catch {
    // Transient D1 errors are retried once before failing closed.
    try {
      await new Promise(resolve => setTimeout(resolve, 20))
      row = await lookupRole(db, session.user.email)
    }
    catch {
      return false
    }
  }
  return !!row && row.role === session.user.role
}

export async function requireValidSession(event: H3Event) {
  const session = await requireUserSession(event)
  if (!(await isSessionValid(session, event))) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Session is no longer valid' })
  }
  return session
}
