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

const ChecklistTemplateSchema = new mongoose.Schema({}, { versionKey: false, strict: false });
const ChecklistTemplate =
  mongoose.models.ChecklistTemplate || mongoose.model("ChecklistTemplate", ChecklistTemplateSchema);

const TEMPLATE_FILES = [
  "fatiga_personal.json",
  "preOperacional.json",
  "take_5.json",
  "transporteDeCarga.json",
  "viajesRemotos.json",
];

function normalizeTemplatePayload(source) {
  return {
    id: String(source.id || source.templateId || "").trim(),
    templateId: String(source.templateId || source.id || "").trim(),
    title: String(source.title || "").trim(),
    shortTitle: String(source.shortTitle || source.shortTible || "").trim(),
    sections: Array.isArray(source.sections) ? source.sections : [],
    metrics: Array.isArray(source.metrics) ? source.metrics : [],
    rules: Array.isArray(source.rules) ? source.rules : [],
  };
}

function comparableTemplateShape(doc) {
  return JSON.stringify({
    id: String(doc.id || doc.templateId || "").trim(),
    templateId: String(doc.templateId || "").trim(),
    title: String(doc.title || "").trim(),
    shortTitle: String(doc.shortTitle || "").trim(),
    sections: Array.isArray(doc.sections) ? doc.sections : [],
    metrics: Array.isArray(doc.metrics) ? doc.metrics : [],
    rules: Array.isArray(doc.rules) ? doc.rules : [],
  });
}

async function syncTemplate(fileName) {
  const fullPath = path.join(process.cwd(), "checklistTemplates", fileName);
  const raw = fs.readFileSync(fullPath, "utf8");
  const parsed = JSON.parse(raw);
  const payload = normalizeTemplatePayload(parsed);

  if (!payload.templateId) {
    throw new Error(`${fileName}: templateId requerido`);
  }
  if (!payload.title) {
    throw new Error(`${fileName}: title requerido`);
  }
  if (!payload.sections.length) {
    throw new Error(`${fileName}: sections debe tener contenido`);
  }

  const latest = await ChecklistTemplate.findOne({ templateId: payload.templateId })
    .sort({ version: -1 })
    .lean();

  if (latest && comparableTemplateShape(latest) === comparableTemplateShape(payload)) {
    console.log(`SKIP ${payload.templateId}: sin cambios (v${latest.version})`);
    return { templateId: payload.templateId, action: "skip", version: latest.version };
  }

  const nextVersion = Number(latest?.version || 0) + 1;
  const created = await ChecklistTemplate.create({
    id: payload.id || payload.templateId,
    templateId: payload.templateId,
    version: nextVersion,
    title: payload.title,
    shortTitle: payload.shortTitle || undefined,
    sections: payload.sections,
    metrics: payload.metrics,
    rules: payload.rules,
    isActive: latest?.isActive ?? true,
    accessMode: latest?.accessMode ?? "all",
    allowedTenantIds: Array.isArray(latest?.allowedTenantIds) ? latest.allowedTenantIds : [],
  });

  console.log(`SYNC ${payload.templateId}: creada v${created.version}`);
  return { templateId: payload.templateId, action: "create", version: created.version };
}

async function run() {
  const dbUrl = loadDatabaseUrl();
  if (!dbUrl) throw new Error("No se encontro DATABASE_URL (env o .env.local)");

  await mongoose.connect(dbUrl, { bufferCommands: false });

  const results = [];
  for (const fileName of TEMPLATE_FILES) {
    const result = await syncTemplate(fileName);
    results.push(result);
  }

  await mongoose.disconnect();

  const created = results.filter((item) => item.action === "create");
  const skipped = results.filter((item) => item.action === "skip");
  console.log(`Resumen: ${created.length} creados, ${skipped.length} sin cambios`);
}

run().catch(async (err) => {
  console.error("Error al sincronizar templates:", err.message || err);
  try {
    await mongoose.disconnect();
  } catch {
    // noop
  }
  process.exit(1);
});
