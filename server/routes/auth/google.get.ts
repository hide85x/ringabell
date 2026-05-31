import { nowUtc } from '~~/utils/date'
import type { User } from '~~/server/models/user'
import { USERS_COLLECTION } from '~~/server/models/user'

export default defineOAuthGoogleEventHandler({
  async onSuccess(event, { user }) {
    const config = useRuntimeConfig(event)
    const db = await getDb({ mongodbUri: config.mongodbUri })

    const doc = await db.collection<User>(USERS_COLLECTION).findOne({ email: user.email })

    if (!doc) {
      return sendRedirect(event, '/?error=unauthorized')
    }

    await db.collection<User>(USERS_COLLECTION).updateOne(
      { email: user.email },
      { $set: { name: user.name, avatar: user.picture } }
    )

    await setUserSession(event, {
      user: {
        email: doc.email,
        name: user.name,
        avatar: user.picture,
        role: doc.role,
      },
    })
    return sendRedirect(event, '/')
  },
})
