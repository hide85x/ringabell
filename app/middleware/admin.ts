export default defineNuxtRouteMiddleware(() => {
  const { user } = useUserSession()
  if (user.value?.role !== 'Admin') {
    return navigateTo('/')
  }
})
