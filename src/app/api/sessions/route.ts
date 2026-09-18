import { getDb } from "@/db";
import { createSession } from "@/lib/seed";
import { json } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim().slice(0, 80) || "Sesión sin nombre";
  const code = await createSession(getDb(), name);
  return json({ code }, 201);
}
