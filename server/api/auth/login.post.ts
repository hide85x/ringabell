import type { User } from '~~/server/models/user'
import { USERS_COLLECTION } from '~~/server/models/user'

export default defineEventHandler(async (event) => {
  const { email, password } = await readBody<{ email: string; password: string }>(event)

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }

  const config = useRuntimeConfig(event)
  const db = await getDb({ mongodbUri: config.mongodbUri })
  const doc = await db.collection<User>(USERS_COLLECTION).findOne({ email })

  if (!doc || !doc.passwordHash) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  const valid = await verifyPassword(doc.passwordHash, password)
  if (!valid) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  await setUserSession(event, {
    user: { email: doc.email, name: doc.name, avatar: doc.avatar, role: doc.role },
  })

  return { ok: true }
})
