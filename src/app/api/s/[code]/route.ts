import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions, flights, steps } from "@/db/schema";
import { badRequest, cleanVars, json, notFound } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { code } = await params;
  const db = getDb();
  const [session] = await db
    .select({
      id: sessions.id,
      code: sessions.code,
      name: sessions.name,
      vars: sessions.vars,
      createdAt: sessions.createdAt,
      resetAt: sessions.resetAt,
    })
    .from(sessions)
    .where(eq(sessions.code, code.toUpperCase()))
    .limit(1);
  if (!session) return notFound();

  const [flightRows, stepRows] = await db.batch([
    db
      .select({ id: flights.id, callsign: flights.callsign, idx: flights.idx, vars: flights.vars })
      .from(flights)
      .where(eq(flights.sessionId, session.id))
      .orderBy(asc(flights.idx)),
    db.select().from(steps).where(eq(steps.sessionId, session.id)).orderBy(asc(steps.idx)),
  ]);

  return json({
    session,
    flights: flightRows,
    steps: stepRows.map(({ sessionId: _s, ...s }) => s),
  });
}

/** Cuerpo: { vars?: {clave: valor}, name?: string }. Las variables se fusionan. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { code } = await params;
  const body = await req.json().catch(() => null);
  const vars = cleanVars(body?.vars ?? {});
  if (!vars) return badRequest("vars debe ser un objeto");
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : null;

  const [row] = await getDb()
    .update(sessions)
    .set({
      vars: sql`${sessions.vars} || ${JSON.stringify(vars)}::jsonb`,
      ...(name ? { name } : {}),
      contentAt: sql`now()`,
    })
    .where(eq(sessions.code, code.toUpperCase()))
    .returning({ vars: sessions.vars, name: sessions.name });
  if (!row) return notFound();
  return json(row);
}
