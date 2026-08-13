export interface Assignment {
  id?: string
  personId: string
  type: 'fight' | 'event'
  fightId?: string
  eventId?: string
  role: string
  corner?: 'red' | 'blue' | null
  createdAt: string
}
