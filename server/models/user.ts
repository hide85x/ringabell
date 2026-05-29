import type { ObjectId } from 'mongodb'

export interface User {
  _id?: ObjectId
  email: string
  name: string
  avatar: string
  role: 'Admin' | 'Manager' | 'Personel'
  createdAt: Date
}

export const USERS_COLLECTION = 'users' as const
