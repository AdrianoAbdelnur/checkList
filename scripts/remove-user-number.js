/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return "";

  const raw = fs.readFileSync(envPath, "utf8");
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key === "DATABASE_URL") return value;
  }
  return "";
}

const UserSchema = new mongoose.Schema(
  {
    userNumber: String,
  },
  { versionKey: false, strict: false },
);

const CounterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false, strict: false },
);

const User = mongoose.models.User || mongoose.model("User", UserSchema);
const Counter = mongoose.models.Counter || mongoose.model("Counter", CounterSchema);

async function dropIndexIfExists(collection, indexName) {
  try {
    const indexes = await collection.indexes();
    const exists = indexes.some((index) => index.name === indexName);
    if (!exists) return false;
    await collection.dropIndex(indexName);
    return true;
  } catch (error) {
    if (error && (error.codeName === "IndexNotFound" || error.code === 27)) return false;
    throw error;
  }
}

async function run() {
  const dbUrl = loadDatabaseUrl();
  if (!dbUrl) throw new Error("No se encontro DATABASE_URL (env o .env.local)");

  await mongoose.connect(dbUrl, { bufferCommands: false });

  const usersResult = await User.updateMany(
    { userNumber: { $exists: true } },
    { $unset: { userNumber: "" } },
  );
  const counterResult = await Counter.deleteOne({ key: "userNumber" });
  const droppedIndex = await dropIndexIfExists(User.collection, "userNumber_1");

  await mongoose.disconnect();

  console.log(`userNumber removido de usuarios: ${usersResult.modifiedCount}`);
  console.log(`contador userNumber eliminado: ${counterResult.deletedCount}`);
  console.log(`indice userNumber_1 eliminado: ${droppedIndex ? "si" : "no"}`);
}

run().catch(async (err) => {
  console.error("Error al eliminar userNumber:", err.message || err);
  try {
    await mongoose.disconnect();
  } catch {
    // noop
  }
  process.exit(1);
});
