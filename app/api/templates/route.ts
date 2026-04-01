import { listLatestActiveTemplates } from "@/lib/templates";
import { requireUser } from "@/lib/auth/requireUser";
import { connectToDatabase } from "@/lib/db";

export async function GET(req: Request) {
  await connectToDatabase();

  const auth = await requireUser(req);
  if (!auth.ok) {
    return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const items = await listLatestActiveTemplates();
  return Response.json({ ok: true, items });
}

