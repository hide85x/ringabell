import type { ObjectId } from 'mongodb'

// Named BoxingEvent (not Event) to avoid collision with the browser DOM global.
export interface BoxingEvent {
  _id?: ObjectId
  name: string
  date: Date
  venue: string
  status: 'draft' | 'published' | 'cancelled'
  createdAt: Date
  updatedAt: Date
}

export const EVENTS_COLLECTION = 'events' as const
