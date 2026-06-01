import { nowUtc } from '~~/utils/date'

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

  const db = getD1(event)

  const existing = await db.prepare('SELECT id FROM users WHERE email = ? LIMIT 1').bind(email).first()
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Email already exists' })
  }

  const passwordHash = password ? await hashPassword(password) : null
  const id = crypto.randomUUID()

  await db.prepare(
    'INSERT INTO users (id, email, name, avatar, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, email, '', '', role, passwordHash, nowUtc()).run()

  return { ok: true }
})
