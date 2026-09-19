import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { flights, sessions } from "@/db/schema";
import { json, notFound } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

/**
 * Vuelve al reparto de vuelos original: quita los nacidos de una división y
 * recrea los que se absorbieron, con sus variables originales. No toca las
 * marcas ni los textos.
 */
export async function POST(_req: Request, { params }: Ctx) {
  const { code } = await params;
  const db = getDb();
  const [session] = await db
    .select({ id: sessions.id, base: sessions.flightsBase })
    .from(sessions)
    .where(eq(sessions.code, code.toUpperCase()))
    .limit(1);
  if (!session) return notFound();

  const deleted = await db
    .delete(flights)
    .where(and(eq(flights.sessionId, session.id), isNotNull(flights.parentId)))
    .returning({ id: flights.id });

  const rest = await db
    .select({ id: flights.id, callsign: flights.callsign, idx: flights.idx })
    .from(flights)
    .where(eq(flights.sessionId, session.id))
    .orderBy(asc(flights.idx));
  const have = new Set(rest.map((f) => f.callsign.toLowerCase()));
  const missing = (session.base ?? []).filter((f) => !have.has(f.callsign.toLowerCase()));
  if (missing.length > 0) {
    let idx = rest.length ? Math.max(...rest.map((f) => f.idx)) + 1 : 0;
    await db.insert(flights).values(missing.map((f) => ({ sessionId: session.id, callsign: f.callsign, idx: idx++, vars: f.vars })));
  }

  await db
    .update(flights)
    .set({ mergedFrom: null, mergedAt: null })
    .where(and(eq(flights.sessionId, session.id), isNotNull(flights.mergedFrom)));
  await db.execute(sql`UPDATE sessions SET updated_at = now(), content_at = now() WHERE id = ${session.id}`);

  return json({ ok: true, quitados: deleted.length, recreados: missing.map((f) => f.callsign) });
}
