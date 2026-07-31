import type { H3Event } from 'h3'

export async function requirePersonel(event: H3Event) {
  const session = await requireValidSession(event)
  if (session.user.role !== 'Personel') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return session
}
