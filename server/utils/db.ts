import { MongoClient, Db } from 'mongodb'

let _client: MongoClient | null = null
let _db: Db | null = null

export async function getDb(config?: { mongodbUri?: string }): Promise<Db> {
  if (_db && _client) return _db

  const uri = config?.mongodbUri || process.env.MONGODB_URI
  if (!uri) {
    throw new Error(
      'MongoDB URI not configured — set MONGODB_URI in .env or pass mongodbUri via config'
    )
  }

  _client = new MongoClient(uri, {
    maxPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
    tls: true,
    // Workers TLS stack does not expose hostname verification hook; required for MongoDB Atlas on Cloudflare Workers.
    checkServerIdentity: () => undefined,
  })
  await _client.connect()

  const dbName = new URL(uri).pathname.replace(/^\//, '') || 'ringabell'
  _db = _client.db(dbName)
  return _db
}
