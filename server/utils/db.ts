import { MongoClient, Db } from 'mongodb'

let _client: MongoClient | null = null
let _db: Db | null = null
let _connecting: Promise<Db> | null = null

export function clearDbCache(): void {
  _client = null
  _db = null
  _connecting = null
}

export async function getDb(config?: { mongodbUri?: string }): Promise<Db> {
  if (_db && _client) return _db
  if (_connecting) return _connecting

  _connecting = (async () => {
    const uri = config?.mongodbUri || process.env.MONGODB_URI
    if (!uri) {
      throw new Error(
        'MongoDB URI not configured — set MONGODB_URI in .env or pass mongodbUri via config'
      )
    }

    _client = new MongoClient(uri, {
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 4000,
      socketTimeoutMS: 4000,
      tls: true,
      // Workers TLS stack does not expose hostname verification hook; required for MongoDB Atlas on Cloudflare Workers.
      checkServerIdentity: () => undefined,
    })

    // serverSelectionTimeoutMS does not interrupt hanging network ops on V8 isolates.
    // Promise.race with setTimeout (native Workers API) ensures the Worker always responds.
    const connectTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('MongoDB connect timed out after 4000ms')), 4000)
    )
    try {
      await Promise.race([_client.connect(), connectTimeout])
    } catch (e) {
      await _client.close().catch(() => {})
      _client = null
      throw e
    }

    const dbName = new URL(uri).pathname.replace(/^\//, '') || 'ringabell'
    _db = _client.db(dbName)
    return _db
  })()

  try {
    return await _connecting
  } finally {
    _connecting = null
  }
}
