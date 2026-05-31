import { nowUtc } from '~~/utils/date'
import { USERS_COLLECTION } from '~~/server/models/user'

const VALID_ROLES = ['Admin', 'Manager', 'Personel'] as const

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { email, role, password } = await readBody<{ email: string; role: string; password?: string }>(event)

  if (!email || !email.includes('@')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid email' })
  }

  if (!VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid role' })
  }

  const config = useRuntimeConfig(event)
  const db = await getDb({ mongodbUri: config.mongodbUri })

  const existing = await db.collection(USERS_COLLECTION).findOne({ email })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Email already exists' })
  }

  const passwordHash = password ? await hashPassword(password) : undefined

  await db.collection(USERS_COLLECTION).insertOne({
    email,
    role,
    name: '',
    avatar: '',
    createdAt: new Date(nowUtc()),
    ...(passwordHash ? { passwordHash } : {}),
  })

  return { ok: true }
})
