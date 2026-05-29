import type { ObjectId } from 'mongodb'

export interface Assignment {
  _id?: ObjectId
  personId: ObjectId
  type: 'fight' | 'event'
  fightId?: ObjectId
  eventId?: ObjectId
  role: string
  createdAt: Date
}

export const ASSIGNMENTS_COLLECTION = 'assignments' as const
