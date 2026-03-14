import mongoose from "mongoose";

import "../models/User";
import "../models/ChecklistTemplate";
import "../models/Checklist";
import "../models/Trip";

const MONGODB_URI = process.env.DATABASE_URL;

type Cached = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var _mongoose: Cached | undefined;
}

const cached: Cached = (global as any)._mongoose || { conn: null, promise: null };

export async function connectToDatabase() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    if (!MONGODB_URI) throw new Error("DATABASE_URL is not defined");
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false }).then((m) => m);
  }

  cached.conn = await cached.promise;
  (global as any)._mongoose = cached;
  return cached.conn;
}
