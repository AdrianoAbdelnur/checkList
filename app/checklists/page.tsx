import Link from "next/link";
import { headers } from "next/headers";

async function api<T>(path: string) {
  const h = await headers();
  const host = h.get("host");
  const proto = process.env.NODE_ENV === "production" ? "https" : "http";
  const url = `${proto}://${host}${path}`;

  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  console.log(json)
  if (!res.ok || !json?.ok) throw new Error(json?.message ?? "Error");
  return json as T;
}

export default async function ChecklistsPage() {
  const data = await api<{ ok: true; items: any[] }>("/api/checklists");

  return (
    <main style={{ padding: 24 }}>
      <h1>Checklists</h1>
      <ul>
        {data.items.map((c) => (
          <li key={c._id}>
            <Link href={`/checklists/${c._id}`}>
              {c.templateId} v{c.templateVersion} — {c.status}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
