import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { flights, sessions } from "@/db/schema";
import { badRequest, clickTime, findSession, json, notFound, observerBlocked, ROLE_RE, UUID_RE } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

/**
 * Cuerpo: { flightId, on, role, at }. Pone o quita el standby de un vuelo:
 * la comunicación con él queda en pausa, y se anota desde cuándo y quién.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { code } = await params;
  const body = await req.json().catch(() => null);
  const blocked = observerBlocked(body?.role);
  if (blocked) return blocked;
  const flightId = typeof body?.flightId === "string" && UUID_RE.test(body.flightId) ? body.flightId : null;
  if (!flightId) return badRequest("Vuelo desconocido");
  const on = body?.on !== false;
  const role = typeof body?.role === "string" && ROLE_RE.test(body.role) ? body.role : null;
  if (on && !role) return badRequest("Falta role");

  const session = await findSession(code);
  if (!session) return notFound();
  const db = getDb();
  const [row] = await db
    .update(flights)
    .set(on ? { standbyAt: clickTime(body?.at), standbyBy: role } : { standbyAt: null, standbyBy: null })
    .where(and(eq(flights.id, flightId), eq(flights.sessionId, session.id)))
    .returning({ id: flights.id, standbyAt: flights.standbyAt, standbyBy: flights.standbyBy });
  if (!row) return json({ error: "Vuelo no encontrado" }, 404);
  await db.update(sessions).set({ updatedAt: sql`now()` }).where(eq(sessions.id, session.id));
  return json(row);
}
