import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { agencyStates, flights, marks, sessions, steps } from "@/db/schema";
import { parseMissionFile } from "@/lib/missionFile";
import { missionInserts } from "@/lib/seed";
import { badRequest, findSession, json, notFound } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

/**
 * Cuerpo: un archivo de misión (formato de guion.json). Sustituye variables,
 * vuelos y guion de la sesión. Como cambian los pasos, borra también las
 * marcas, el estado de las agencias y la hora de inicio.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { code } = await params;
  const body = await req.json().catch(() => null);
  const parsed = parseMissionFile(body);
  if (!parsed.ok) return badRequest(parsed.error);
  const { mission } = parsed;

  const session = await findSession(code);
  if (!session) return notFound();
  const db = getDb();
  const sid = session.id;

  // El batch es una transacción: o se sustituye todo o no cambia nada.
  await db.batch([
    db.delete(marks).where(eq(marks.sessionId, sid)),
    db.delete(agencyStates).where(eq(agencyStates.sessionId, sid)),
    db.delete(steps).where(eq(steps.sessionId, sid)),
    db.delete(flights).where(eq(flights.sessionId, sid)),
    db
      .update(sessions)
      .set({ vars: mission.vars, startedAt: null, updatedAt: sql`now()`, contentAt: sql`now()` })
      .where(eq(sessions.id, sid)),
    ...missionInserts(db, sid, mission),
  ]);

  return json({ ok: true, flights: mission.flights.length, steps: mission.steps.length });
}
