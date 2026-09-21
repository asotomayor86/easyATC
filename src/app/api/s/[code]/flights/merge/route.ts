import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { flights, marks, sessions } from "@/db/schema";
import { badRequest, clickTime, json, notFound, observerBlocked, ROLE_RE, UUID_RE } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

/**
 * Cuerpo: { fromId, intoId, role, at }. Combina dos vuelos: sobrevive `intoId`
 * con su plan intacto y `fromId` desaparece. Las marcas del absorbido pasan al
 * superviviente conservando estado, autor y hora; si el superviviente ya tenía
 * marca en esa transmisión, se queda la suya.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { code } = await params;
  const body = await req.json().catch(() => null);
  const blocked = observerBlocked(body?.role);
  if (blocked) return blocked;
  const fromId = typeof body?.fromId === "string" && UUID_RE.test(body.fromId) ? body.fromId : null;
  const intoId = typeof body?.intoId === "string" && UUID_RE.test(body.intoId) ? body.intoId : null;
  const role = typeof body?.role === "string" && ROLE_RE.test(body.role) ? body.role : null;
  if (!fromId || !intoId || fromId === intoId) return badRequest("Hacen falta dos vuelos distintos");
  if (!role) return badRequest("Falta role");

  const db = getDb();
  const [session] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.code, code.toUpperCase()))
    .limit(1);
  if (!session) return notFound();

  const rows = await db
    .select({ id: flights.id, callsign: flights.callsign })
    .from(flights)
    .where(eq(flights.sessionId, session.id));
  const from = rows.find((f) => f.id === fromId);
  const into = rows.find((f) => f.id === intoId);
  if (!from || !into) return badRequest("Vuelo desconocido");

  const at = clickTime(body?.at);
  // Las marcas del absorbido pasan al superviviente, salvo las que ya tuviera.
  await db.execute(sql`
    UPDATE ${marks} SET flight_id = ${intoId}
    WHERE flight_id = ${fromId}
      AND NOT EXISTS (SELECT 1 FROM ${marks} m WHERE m.step_id = ${marks}.step_id AND m.flight_id = ${intoId})
  `);
  await db.update(flights).set({ mergedFrom: from.callsign, mergedAt: at }).where(eq(flights.id, intoId));
  await db.delete(flights).where(and(eq(flights.id, fromId), eq(flights.sessionId, session.id)));
  // Fuera del tablero: se quitan sus posiciones en todas las agencias.
  await db.execute(sql`
    UPDATE sessions SET
      board_state = coalesce((
        SELECT jsonb_object_agg(e.k, e.v - ${fromId}::text) FROM jsonb_each(board_state) AS e(k, v)
      ), '{}'::jsonb),
      updated_at = now(), content_at = now()
    WHERE id = ${session.id}
  `);

  return json({ ok: true, absorbido: from.callsign, superviviente: into.callsign });
}
