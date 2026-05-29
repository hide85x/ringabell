import { ObjectId } from 'mongodb'
import { USERS_COLLECTION } from '~~/server/models/user'

const VALID_ROLES = ['Admin', 'Manager', 'Personel'] as const

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  const { role } = await readBody<{ role: string }>(event)

  if (!VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid role' })
  }

  const config = useRuntimeConfig(event)
  const db = await getDb({ mongodbUri: config.mongodbUri })
  await db.collection(USERS_COLLECTION).updateOne(
    { _id: new ObjectId(id) },
    { $set: { role } }
  )
  return { ok: true }
})
