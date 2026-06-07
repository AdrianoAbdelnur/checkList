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

const UserSchema = new mongoose.Schema({}, { versionKey: false, strict: false });
const ChecklistSchema = new mongoose.Schema({}, { versionKey: false, strict: false });
const ChecklistTemplateSchema = new mongoose.Schema({}, { versionKey: false, strict: false });

const User = mongoose.models.User || mongoose.model("User", UserSchema);
const Checklist = mongoose.models.Checklist || mongoose.model("Checklist", ChecklistSchema);
const ChecklistTemplate =
  mongoose.models.ChecklistTemplate || mongoose.model("ChecklistTemplate", ChecklistTemplateSchema);

function missingTenantFilter() {
  return {
    $or: [{ tenantId: { $exists: false } }, { tenantId: null }, { tenantId: "" }],
  };
}

async function run() {
  const dbUrl = loadDatabaseUrl();
  if (!dbUrl) throw new Error("No se encontro DATABASE_URL (env o .env.local)");

  await mongoose.connect(dbUrl, { bufferCommands: false });

  const [usersBefore, checklistsBefore, templatesModeBefore, templatesAllowedBefore] = await Promise.all([
    User.countDocuments(missingTenantFilter()),
    Checklist.countDocuments(missingTenantFilter()),
    ChecklistTemplate.countDocuments({ accessMode: { $exists: false } }),
    ChecklistTemplate.countDocuments({ allowedTenantIds: { $exists: false } }),
  ]);

  const [usersResult, checklistsResult, templatesModeResult, templatesAllowedResult] = await Promise.all([
    User.updateMany(missingTenantFilter(), { $set: { tenantId: "general" } }),
    Checklist.updateMany(missingTenantFilter(), { $set: { tenantId: "general" } }),
    ChecklistTemplate.updateMany({ accessMode: { $exists: false } }, { $set: { accessMode: "all" } }),
    ChecklistTemplate.updateMany(
      { allowedTenantIds: { $exists: false } },
      { $set: { allowedTenantIds: [] } },
    ),
  ]);

  const [usersAfter, checklistsAfter, templatesModeAfter, templatesAllowedAfter] = await Promise.all([
    User.countDocuments(missingTenantFilter()),
    Checklist.countDocuments(missingTenantFilter()),
    ChecklistTemplate.countDocuments({ accessMode: { $exists: false } }),
    ChecklistTemplate.countDocuments({ allowedTenantIds: { $exists: false } }),
  ]);

  await mongoose.disconnect();

  console.log("Backfill tenant/general completado");
  console.log(`Usuarios sin tenantId antes: ${usersBefore}`);
  console.log(`Usuarios actualizados: ${usersResult.modifiedCount}`);
  console.log(`Usuarios sin tenantId despues: ${usersAfter}`);
  console.log(`Checklists sin tenantId antes: ${checklistsBefore}`);
  console.log(`Checklists actualizados: ${checklistsResult.modifiedCount}`);
  console.log(`Checklists sin tenantId despues: ${checklistsAfter}`);
  console.log(`Templates sin accessMode antes: ${templatesModeBefore}`);
  console.log(`Templates accessMode actualizados: ${templatesModeResult.modifiedCount}`);
  console.log(`Templates sin accessMode despues: ${templatesModeAfter}`);
  console.log(`Templates sin allowedTenantIds antes: ${templatesAllowedBefore}`);
  console.log(`Templates allowedTenantIds actualizados: ${templatesAllowedResult.modifiedCount}`);
  console.log(`Templates sin allowedTenantIds despues: ${templatesAllowedAfter}`);
}

run().catch(async (err) => {
  console.error("Error en backfill tenant/general:", err.message || err);
  try {
    await mongoose.disconnect();
  } catch {
    // noop
  }
  process.exit(1);
});
