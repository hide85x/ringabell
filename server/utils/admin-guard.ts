export async function requireAdmin(event: H3Event) {
  const session = await requireUserSession(event)
  if (session.user.role !== 'Admin') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return session
}
