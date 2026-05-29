import { nowUtc } from '~~/utils/date'
import type { User } from '~~/server/models/user'
import { USERS_COLLECTION } from '~~/server/models/user'

export default defineOAuthGoogleEventHandler({
  async onSuccess(event, { user }) {
    const config = useRuntimeConfig(event)
    const db = await getDb({ mongodbUri: config.mongodbUri })

    const doc = await db.collection<User>(USERS_COLLECTION).findOneAndUpdate(
      { email: user.email },
      {
        $setOnInsert: { role: 'Personel' as const, createdAt: new Date(nowUtc()) },
        $set: { name: user.name, avatar: user.picture },
      },
      { upsert: true, returnDocument: 'after' }
    )

    await setUserSession(event, {
      user: {
        email: doc!.email,
        name: doc!.name,
        avatar: doc!.avatar,
        role: doc!.role,
      },
    })
    return sendRedirect(event, '/')
  },
})
