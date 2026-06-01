export default defineOAuthGoogleEventHandler({
  async onSuccess(event, { user }) {
    const db = getD1(event)

    const doc = await db.prepare(
      'SELECT id, email, name, avatar, role FROM users WHERE email = ? LIMIT 1'
    ).bind(user.email).first()

    if (!doc) {
      return sendRedirect(event, '/?error=unauthorized')
    }

    await db.prepare(
      'UPDATE users SET name = ?, avatar = ? WHERE email = ?'
    ).bind(user.name, user.picture, user.email).run()

    await setUserSession(event, {
      user: {
        email: doc.email as string,
        name: user.name,
        avatar: user.picture,
        role: doc.role as string,
      },
    })
    return sendRedirect(event, '/')
  },
})
