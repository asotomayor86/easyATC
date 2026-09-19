import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { flights, sessions } from "@/db/schema";
import { UUID_RE, badRequest, cleanVars, findSession, json, notFound } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string; id: string }> };

/**
 * Cuerpo: { vars?: {clave: valor}, remove?: [clave] }. Las variables se
 * fusionan y las de `remove` se borran; `cs` actualiza también el indicativo.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const { code, id } = await params;
  if (!UUID_RE.test(id)) return json({ error: "Vuelo no encontrado" }, 404);
  const body = await req.json().catch(() => null);
  const vars = cleanVars(body?.vars ?? {});
  if (!vars) return badRequest("vars debe ser un objeto");
  const remove = Array.isArray(body?.remove)
    ? body.remove.filter((k: unknown): k is string => typeof k === "string" && /^[a-z0-9_]{1,40}$/.test(k))
    : [];

  const session = await findSession(code);
  if (!session) return notFound();
  const db = getDb();
  let merged = sql`${flights.vars} || ${JSON.stringify(vars)}::jsonb`;
  // «jsonb - texto» quita esa clave; se encadena una por variable a borrar.
  for (const k of remove) merged = sql`(${merged}) - ${k}::text`;
  const [row] = await db
    .update(flights)
    .set({
      vars: merged,
      ...(vars.cs?.trim() ? { callsign: vars.cs.trim() } : {}),
    })
    .where(and(eq(flights.id, id), eq(flights.sessionId, session.id)))
    .returning({ id: flights.id, callsign: flights.callsign, vars: flights.vars });
  if (!row) return json({ error: "Vuelo no encontrado" }, 404);
  await db.update(sessions).set({ contentAt: sql`now()` }).where(eq(sessions.id, session.id));
  return json(row);
}
