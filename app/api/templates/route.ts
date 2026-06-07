import { requireUser } from "@/lib/auth/requireUser";
import { connectToDatabase } from "@/lib/db";
import { listLatestActiveTemplatesForUser } from "@/lib/templates";

export async function GET(req: Request) {
  await connectToDatabase();

  const auth = await requireUser(req);
  if (!auth.ok) {
    return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const items = await listLatestActiveTemplatesForUser(auth.user as any);
  return Response.json({ ok: true, items });
}
