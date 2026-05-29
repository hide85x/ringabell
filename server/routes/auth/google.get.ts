export default defineOAuthGoogleEventHandler({
  async onSuccess(event, { user }) {
    await setUserSession(event, {
      user: {
        email: user.email,
        name: user.name,
        avatar: user.picture,
        role: 'Personel',
      },
    })
    return sendRedirect(event, '/')
  },
})
