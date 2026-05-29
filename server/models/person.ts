import type { ObjectId } from 'mongodb'

export interface Person {
  _id?: ObjectId
  name: string
  email?: string
  phone?: string
  role: string
  isActive: boolean
  createdAt: Date
}

export const PERSONS_COLLECTION = 'persons' as const
