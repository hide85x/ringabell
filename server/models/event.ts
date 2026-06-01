// Named BoxingEvent (not Event) to avoid collision with the browser DOM global.
export interface BoxingEvent {
  id?: string
  name: string
  date: string
  venue: string
  status: 'draft' | 'published' | 'cancelled'
  createdAt: string
}
