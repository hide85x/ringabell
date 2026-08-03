export default defineNuxtPlugin(() => {
  const { clear } = useUserSession()

  globalThis.$fetch = $fetch.create({
    async onResponseError({ response }) {
      if (response.status === 401) {
        await clear()
        await navigateTo('/')
      }
    },
  })
})
