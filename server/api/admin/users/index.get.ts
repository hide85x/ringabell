import type { User } from '~~/server/models/user'
import { USERS_COLLECTION } from '~~/server/models/user'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const config = useRuntimeConfig(event)
  const db = await getDb({ mongodbUri: config.mongodbUri })
  const users = await db.collection<User>(USERS_COLLECTION).find({}).toArray()
  return users
})
