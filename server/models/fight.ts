export interface Fight {
  id?: string
  eventId: string
  orderNumber: number
  requirements: Array<{ role: string; count: number }>
  createdAt: string
}
