import type { H3Event } from 'h3'

export function getD1(event: H3Event) {
  const db = (event.context.cloudflare?.env as any)?.DB
  if (!db) throw createError({ statusCode: 500, statusMessage: 'D1 binding not available' })
  return db as any
}
