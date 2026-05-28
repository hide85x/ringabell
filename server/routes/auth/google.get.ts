export default defineOAuthGoogleEventHandler({
  async onSuccess(event, { user }) {
    await setUserSession(event, {
      user: {
        email: user.email,
        name: user.name,
        avatar: user.picture,
      },
    })
    return sendRedirect(event, '/')
  },
})
