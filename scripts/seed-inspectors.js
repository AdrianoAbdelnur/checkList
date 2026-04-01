/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
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
    firstName: String,
    lastName: String,
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    salt: String,
    telephone: String,
    createdAt: { type: Date, default: Date.now },
    isDelete: { type: Boolean, default: false },
    role: {
      type: String,
      enum: ["inspector", "reviewer", "supervisor", "manager", "admin"],
      default: "inspector",
    },
    roles: {
      type: [String],
      enum: ["inspector", "reviewer", "supervisor", "manager", "admin"],
      default: ["inspector"],
    },
    assignedTemplateIds: { type: [String], default: [] },
    userNumber: { type: String, trim: true, unique: true, sparse: true, index: true },
  },
  { versionKey: false, strict: false }
);

const User = mongoose.models.User || mongoose.model("User", UserSchema);

async function run() {
  const dbUrl = loadDatabaseUrl();
  if (!dbUrl) {
    throw new Error("No se encontrÃ³ DATABASE_URL (env o .env.local)");
  }

  const count = Number(process.argv[2] || 20);
  const baseEmail = String(process.argv[3] || "inspector.test");
  const password = String(process.argv[4] || "111111");

  await mongoose.connect(dbUrl, { bufferCommands: false });

  let created = 0;
  let updated = 0;

  for (let i = 1; i <= count; i += 1) {
    const idx = String(i).padStart(2, "0");
    const email = `${baseEmail}${idx}@demo.local`;
    const firstName = `Inspector ${idx}`;
    const lastName = "Prueba";
    const userNumber = `9${String(i).padStart(3, "0")}`;
    const salt = crypto.randomBytes(16).toString("hex");
    const derived = crypto.scryptSync(password, salt, 64).toString("hex");

    const res = await User.updateOne(
      { email },
      {
        $set: {
          firstName,
          lastName,
          email,
          role: "inspector",
          roles: ["inspector"],
          isDelete: false,
          password: derived,
          salt,
          userNumber,
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    if (res.upsertedCount > 0) created += 1;
    else if (res.modifiedCount > 0 || res.matchedCount > 0) updated += 1;
  }

  await mongoose.disconnect();
  console.log(`OK. Inspectores procesados: ${count}. Creados: ${created}. Actualizados: ${updated}.`);
  console.log(`Password comÃºn: ${password}`);
  console.log(`Email ejemplo: ${baseEmail}01@demo.local`);
}

run().catch(async (err) => {
  console.error("Error al sembrar inspectores:", err.message || err);
  try {
    await mongoose.disconnect();
  } catch {
    // noop
  }
  process.exit(1);
});


