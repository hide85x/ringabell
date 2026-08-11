export default defineNuxtPlugin(() => {
  const { clear } = useUserSession()

  const GUARDED_PREFIXES = ['/api/admin', '/api/manager', '/api/personel']

  globalThis.$fetch = $fetch.create({
    async onResponseError({ request, response }) {
      const url = typeof request === 'string' ? request : request.url
      const isGuarded = GUARDED_PREFIXES.some(prefix => url.includes(prefix))
      if (response.status === 401 && isGuarded) {
        await clear()
        await navigateTo('/')
      }
    },
  })
})
