import type { H3Event } from 'h3'

export async function requireAdmin(event: H3Event) {
  const session = await requireValidSession(event)
  if (session.user.role !== 'Admin') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return session
}
