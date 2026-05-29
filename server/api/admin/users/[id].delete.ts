import { ObjectId } from 'mongodb'
import { USERS_COLLECTION } from '~~/server/models/user'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  const config = useRuntimeConfig(event)
  const db = await getDb({ mongodbUri: config.mongodbUri })
  await db.collection(USERS_COLLECTION).deleteOne({ _id: new ObjectId(id) })
  return { ok: true }
})
