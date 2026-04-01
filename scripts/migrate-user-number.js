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
    createdAt: Date,
    userNumber: String,
    inspectorNumber: String,
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

function toNumericUserNumber(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

async function run() {
  const dbUrl = loadDatabaseUrl();
  if (!dbUrl) throw new Error("No se encontro DATABASE_URL (env o .env.local)");

  await mongoose.connect(dbUrl, { bufferCommands: false });

  const users = await User.find({})
    .select("_id createdAt userNumber inspectorNumber")
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  const counter = await Counter.findOne({ key: "userNumber" }).lean();
  const counterSeq = Number(counter?.seq || 0);

  let maxExisting = 0;
  for (const user of users) {
    const n = toNumericUserNumber(user.userNumber);
    if (n && n > maxExisting) maxExisting = n;
  }

  let next = Math.max(counterSeq, maxExisting);
  let assigned = 0;
  const ops = [];

  for (const user of users) {
    const current = toNumericUserNumber(user.userNumber);
    if (current) {
      if (user.inspectorNumber !== undefined) {
        ops.push({
          updateOne: {
            filter: { _id: user._id },
            update: { $unset: { inspectorNumber: "" } },
          },
        });
      }
      continue;
    }

    next += 1;
    assigned += 1;
    ops.push({
      updateOne: {
        filter: { _id: user._id },
        update: {
          $set: { userNumber: String(next) },
          $unset: { inspectorNumber: "" },
        },
      },
    });
  }

  if (ops.length > 0) {
    await User.bulkWrite(ops, { ordered: true });
  }

  const cleanup = await User.updateMany(
    { inspectorNumber: { $exists: true } },
    { $unset: { inspectorNumber: "" } },
  );

  const finalSeq = Math.max(next, counterSeq, maxExisting);
  await Counter.findOneAndUpdate(
    { key: "userNumber" },
    { $set: { seq: finalSeq } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  try {
    await User.collection.dropIndex("inspectorNumber_1");
  } catch {
    // index might not exist; ignore
  }

  await User.collection.createIndex({ userNumber: 1 }, { unique: true, sparse: true });

  await mongoose.disconnect();
  console.log(`Usuarios revisados: ${users.length}`);
  console.log(`userNumber asignado a faltantes: ${assigned}`);
  console.log(`inspectorNumber removido: ${cleanup.modifiedCount}`);
  console.log(`Secuencia userNumber actualizada a: ${finalSeq}`);
}

run().catch(async (err) => {
  console.error("Error en migracion userNumber:", err.message || err);
  try {
    await mongoose.disconnect();
  } catch {
    // noop
  }
  process.exit(1);
});
