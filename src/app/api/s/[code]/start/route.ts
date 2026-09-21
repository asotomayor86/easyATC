import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions } from "@/db/schema";
import { clickTime, json, notFound, observerBlocked } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

/** Marca ahora como el momento en que se quita la pausa de la misión (y borra las pausas). */
export async function POST(req: Request, { params }: Ctx) {
  const { code } = await params;
  const body = await req.json().catch(() => null);
  const blocked = observerBlocked(body?.role);
  if (blocked) return blocked;
  const [row] = await getDb()
    .update(sessions)
    .set({ startedAt: clickTime(body?.at), pauses: [], updatedAt: sql`now()` })
    .where(eq(sessions.code, code.toUpperCase()))
    .returning({ startedAt: sessions.startedAt });
  if (!row) return notFound();
  return json(row);
}
