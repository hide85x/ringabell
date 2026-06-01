export default defineEventHandler(async (event) => {
  const { email, password } = await readBody<{ email: string; password: string }>(event)

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }

  const db = getD1(event)
  const doc = await db.prepare(
    'SELECT id, email, name, avatar, role, password_hash AS passwordHash FROM users WHERE email = ? LIMIT 1'
  ).bind(email).first()

  if (!doc || !doc.passwordHash) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  const valid = await verifyPassword(doc.passwordHash as string, password)
  if (!valid) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  await setUserSession(event, {
    user: {
      email: doc.email as string,
      name: doc.name as string,
      avatar: doc.avatar as string,
      role: doc.role as string,
    },
  })

  return { ok: true }
})
