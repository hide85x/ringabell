import type { ObjectId } from 'mongodb'

export interface Fight {
  _id?: ObjectId
  eventId: ObjectId
  orderNumber: number
  requirements: Array<{ role: string; count: number }>
  createdAt: Date
}

export const FIGHTS_COLLECTION = 'fights' as const
