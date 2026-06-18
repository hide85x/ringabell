export default defineNuxtRouteMiddleware(() => {
  const { user } = useUserSession()
  if (!['Admin', 'Manager'].includes(user.value?.role ?? '')) {
    return navigateTo('/')
  }
})
