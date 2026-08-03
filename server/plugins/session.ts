export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', async (session, event) => {
    if (!(await isSessionValid(session, event))) {
      throw createError({ statusCode: 401, statusMessage: 'Session is no longer valid' })
    }
  })
})
