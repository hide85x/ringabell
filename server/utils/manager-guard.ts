import type { H3Event } from 'h3'

export async function requireManager(event: H3Event) {
  const session = await requireUserSession(event)
  if (!['Admin', 'Manager'].includes(session.user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return session
}
