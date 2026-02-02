import mongoose from 'mongoose'

import '../models/User'


const MONGODB_URI = process.env.DATABASE_URL

if (!MONGODB_URI) {
  // do not throw here to keep dev from breaking silently, but warn
  console.warn('Warning: DATABASE_URL not set in environment')
}

type Cached = {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoose: Cached | undefined
}

const cached: Cached = (global as any)._mongoose || { conn: null, promise: null }

export async function connectToDatabase() {
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    const opts = {
      // Recommended options
      bufferCommands: false,
      // useUnifiedTopology and useNewUrlParser are defaults in recent mongoose
    }
    if (!MONGODB_URI) throw new Error('DATABASE_URL is not defined')
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => m)
  }

  cached.conn = await cached.promise
  ;(global as any)._mongoose = cached
  return cached.conn
}
