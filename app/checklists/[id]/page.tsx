import ChecklistViewer from "./viewer";
import { headers } from "next/headers";

async function api(path: string) {
  const h = await headers();
  const host = h.get("host");
  const proto = process.env.NODE_ENV === "production" ? "https" : "http";
  const url = `${proto}://${host}${path}`;

  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
  if (json?.ok === false) throw new Error(json?.message ?? "API ok:false");
  return json;
}

export default async function ChecklistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const fullRes = await api(`/api/checklists/${id}/full`);

  const checklist =
    fullRes.item ?? fullRes.checklist ?? fullRes.data ?? fullRes.result;

  if (!checklist) throw new Error("El /full no devolvió checklist");

  const templateRes = await api(
    `/api/templates/${checklist.templateId}/versions/${checklist.templateVersion}`
  );

  const template =
    templateRes.item ?? templateRes.template ?? templateRes.data ?? templateRes.result;

  if (!template) throw new Error("El template no se pudo cargar");

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 6 }}>
        {checklist.templateId} v{checklist.templateVersion}
      </h1>
      <div style={{ opacity: 0.8, marginBottom: 18 }}>
        Estado: <b>{checklist.status}</b>
      </div>

      <ChecklistViewer template={template} checklist={checklist} />
    </main>
  );
}
