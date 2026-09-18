import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { flights, sessions } from "@/db/schema";
import { UUID_RE, badRequest, cleanVars, findSession, json, notFound } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string; id: string }> };

/** Cuerpo: { vars: {clave: valor} }. Se fusionan; `cs` actualiza también el indicativo. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { code, id } = await params;
  if (!UUID_RE.test(id)) return json({ error: "Vuelo no encontrado" }, 404);
  const body = await req.json().catch(() => null);
  const vars = cleanVars(body?.vars);
  if (!vars) return badRequest("vars debe ser un objeto");

  const session = await findSession(code);
  if (!session) return notFound();
  const db = getDb();
  const [row] = await db
    .update(flights)
    .set({
      vars: sql`${flights.vars} || ${JSON.stringify(vars)}::jsonb`,
      ...(vars.cs?.trim() ? { callsign: vars.cs.trim() } : {}),
    })
    .where(and(eq(flights.id, id), eq(flights.sessionId, session.id)))
    .returning({ id: flights.id, callsign: flights.callsign, vars: flights.vars });
  if (!row) return json({ error: "Vuelo no encontrado" }, 404);
  await db.update(sessions).set({ contentAt: sql`now()` }).where(eq(sessions.id, session.id));
  return json(row);
}
