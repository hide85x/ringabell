export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', async (session, event) => {
    if (!session.user) return
    if (!(await isSessionValid(session, event))) {
      await clearUserSession(event)
      throw createError({ statusCode: 401, statusMessage: 'Session is no longer valid' })
    }
  })
})
