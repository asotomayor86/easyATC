import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { agencyStates, flights, marks, sessions } from "@/db/schema";
import { findSession, json, notFound, observerBlocked } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const body = await req.json().catch(() => null);
  const blocked = observerBlocked(body?.role);
  if (blocked) return blocked;
  const { code } = await params;
  const session = await findSession(code);
  if (!session) return notFound();
  const db = getDb();
  await db.batch([
    db.delete(marks).where(eq(marks.sessionId, session.id)),
    db.delete(agencyStates).where(eq(agencyStates.sessionId, session.id)),
    // El standby es estado del ejercicio, como las marcas: el reset también lo quita.
    db.update(flights).set({ standbyAt: null, standbyBy: null }).where(eq(flights.sessionId, session.id)),
    db
      .update(sessions)
      .set({ resetAt: sql`now()`, updatedAt: sql`now()`, startedAt: null, pauses: [], boardState: {} })
      .where(eq(sessions.id, session.id)),
  ]);
  return json({ ok: true });
}
