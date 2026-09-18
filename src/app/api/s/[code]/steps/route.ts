import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions, steps } from "@/db/schema";
import { UUID_RE, badRequest, findSession, json, notFound } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

/**
 * Cuerpo: { afterId }. Crea una comunicación justo debajo de `afterId`, con su
 * misma agencia, controlador, fase, ámbito, iniciador y hora, y textos vacíos.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { code } = await params;
  const body = await req.json().catch(() => null);
  const afterId = typeof body?.afterId === "string" && UUID_RE.test(body.afterId) ? body.afterId : null;
  if (!afterId) return badRequest("Falta afterId");

  const session = await findSession(code);
  if (!session) return notFound();
  const db = getDb();
  const [cur] = await db
    .select()
    .from(steps)
    .where(and(eq(steps.id, afterId), eq(steps.sessionId, session.id)))
    .limit(1);
  if (!cur) return json({ error: "Paso no encontrado" }, 404);

  // El batch es una transacción: se abre hueco y se inserta a la vez.
  const [, inserted] = await db.batch([
    db
      .update(steps)
      .set({ idx: sql`${steps.idx} + 1` })
      .where(and(eq(steps.sessionId, session.id), gt(steps.idx, cur.idx))),
    db
      .insert(steps)
      .values({
        sessionId: session.id,
        idx: cur.idx + 1,
        phase: cur.phase,
        agency: cur.agency,
        controller: cur.controller,
        scope: cur.scope,
        initiator: cur.initiator,
        pilotText: null,
        atcText: "",
        readbackText: null,
        eta: cur.eta,
        alt: false,
        note: "",
        checklist: "",
        counts: true,
      })
      .returning(),
    db.update(sessions).set({ contentAt: sql`now()` }).where(eq(sessions.id, session.id)),
  ]);
  const { sessionId: _s, ...step } = inserted[0];
  return json(step, 201);
}
