import { listLatestActiveTemplates } from "@/lib/templates";

export async function GET() {
  const items = await listLatestActiveTemplates();
  return Response.json({ ok: true, items });
}
