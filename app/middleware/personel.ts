export default defineNuxtRouteMiddleware(() => {
  const { user } = useUserSession()
  if (user.value?.role !== 'Personel') {
    return navigateTo('/')
  }
})
