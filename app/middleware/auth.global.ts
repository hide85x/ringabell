export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/' || to.path.startsWith('/auth/')) return

  const { loggedIn } = useUserSession()

  if (!loggedIn.value) {
    return navigateTo('/')
  }
})
