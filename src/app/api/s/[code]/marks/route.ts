import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { flights, marks, sessions, steps } from "@/db/schema";
import { badRequest, findSession, json, notFound, ROLE_RE, UUID_RE } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

/** Cuerpo: { stepId, flightId (null en ámbito «todos»), status: 'ok'|'warn'|'ko'|'na'|null, role }. null = pendiente. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { code } = await params;
  const body = await req.json().catch(() => null);
  const stepId = typeof body?.stepId === "string" && UUID_RE.test(body.stepId) ? body.stepId : null;
  const flightId = typeof body?.flightId === "string" && UUID_RE.test(body.flightId) ? body.flightId : null;
  const status = ["ok", "warn", "ko", "na"].includes(body?.status) ? (body.status as string) : null;
  if (body?.status != null && !status) return badRequest("status debe ser 'ok', 'warn', 'ko', 'na' o null");
  const role = typeof body?.role === "string" && ROLE_RE.test(body.role) ? body.role : null;
  if (!stepId) return badRequest("Falta stepId");
  if (status && !role) return badRequest("Falta role");

  const session = await findSession(code);
  if (!session) return notFound();
  const db = getDb();

  // Comprueba que el paso (y el vuelo) pertenecen a esta sesión y cuadran con el ámbito.
  const [step] = await db
    .select({ scope: steps.scope })
    .from(steps)
    .where(and(eq(steps.id, stepId), eq(steps.sessionId, session.id)))
    .limit(1);
  if (!step) return badRequest("Paso desconocido");
  if (step.scope === "vuelo") {
    if (!flightId) return badRequest("Falta flightId");
    const [f] = await db
      .select({ id: flights.id })
      .from(flights)
      .where(and(eq(flights.id, flightId), eq(flights.sessionId, session.id)))
      .limit(1);
    if (!f) return badRequest("Vuelo desconocido");
  }
  const fid = step.scope === "vuelo" ? flightId : null;

  // El batch de neon-http es una transacción: borrar y volver a insertar es atómico.
  const remove = db
    .delete(marks)
    .where(and(eq(marks.stepId, stepId), fid ? eq(marks.flightId, fid) : isNull(marks.flightId)));
  const touch = db
    .update(sessions)
    .set({ updatedAt: sql`now()` })
    .where(eq(sessions.id, session.id));

  if (status) {
    await db.batch([
      remove,
      db.insert(marks).values({ sessionId: session.id, stepId, flightId: fid, doneBy: role!, status }),
      touch,
    ]);
  } else {
    await db.batch([remove, touch]);
  }
  return json({ ok: true });
}
