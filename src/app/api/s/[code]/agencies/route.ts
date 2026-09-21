import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { agencyStates, sessions } from "@/db/schema";
import { GUION } from "@/lib/guion";
import { badRequest, findSession, json, notFound, observerBlocked, ROLE_RE } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

const STATES = ["cerrada", "abierta", "finalizada"];
const AGENCIES = new Set(GUION.agencias.map((a) => a.id));

/** Cuerpo: { agency, state: 'cerrada'|'abierta'|'finalizada', role }. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { code } = await params;
  const body = await req.json().catch(() => null);
  const blocked = observerBlocked(body?.role);
  if (blocked) return blocked;
  const agency = typeof body?.agency === "string" && AGENCIES.has(body.agency) ? body.agency : null;
  const state = STATES.includes(body?.state) ? (body.state as string) : null;
  const role = typeof body?.role === "string" && ROLE_RE.test(body.role) ? body.role : null;
  if (!agency) return badRequest("Agencia desconocida");
  if (!state) return badRequest("state debe ser cerrada, abierta o finalizada");
  if (!role) return badRequest("Falta role");

  const session = await findSession(code);
  if (!session) return notFound();
  const db = getDb();
  await db.batch([
    db
      .insert(agencyStates)
      .values({ sessionId: session.id, agency, state, changedBy: role })
      .onConflictDoUpdate({
        target: [agencyStates.sessionId, agencyStates.agency],
        set: { state, changedBy: role, changedAt: sql`now()` },
      }),
    db.update(sessions).set({ updatedAt: sql`now()` }).where(eq(sessions.id, session.id)),
  ]);
  return json({ ok: true });
}
