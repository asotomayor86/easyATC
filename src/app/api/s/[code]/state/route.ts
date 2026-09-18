import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { agencyStates, marks } from "@/db/schema";
import { json, notFound, ROLE_RE } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

const PRESENCE_TTL = "20 seconds";

/**
 * Sondeo. Con ?role=C1&cid=xxx registra además la presencia de quien pregunta,
 * para poder mostrar cuántas personas tienen cada rol abierto.
 */
export async function GET(req: Request, { params }: Ctx) {
  const { code } = await params;
  const url = new URL(req.url);
  const role = url.searchParams.get("role");
  const cid = url.searchParams.get("cid");
  const db = getDb();
  const upper = code.toUpperCase();

  const entry =
    role && ROLE_RE.test(role) && cid && /^[\w-]{4,64}$/.test(cid)
      ? sql`jsonb_build_object(${cid}::text, jsonb_build_object('role', ${role}::text, 'at', now()))`
      : sql`'{}'::jsonb`;

  const result = await db.execute<{
    id: string;
    updated_at: string;
    content_at: string;
    started_at: string | null;
    pauses: { from: string; to: string | null }[];
    server_now: string;
    presence: Record<string, { role: string; at: string }>;
  }>(sql`
    UPDATE sessions SET presence = (
      SELECT coalesce(jsonb_object_agg(e.k, e.v), '{}'::jsonb)
      FROM jsonb_each(sessions.presence || ${entry}) AS e(k, v)
      WHERE (e.v->>'at')::timestamptz > now() - interval '${sql.raw(PRESENCE_TTL)}'
    )
    WHERE code = ${upper}
    RETURNING id, updated_at, content_at, started_at, pauses, presence, now() AS server_now
  `);
  const s = result.rows[0];
  if (!s) return notFound();

  const [markRows, agencyRows] = await db.batch([
    db
      .select({
        stepId: marks.stepId,
        flightId: marks.flightId,
        status: marks.status,
        doneAt: marks.doneAt,
        doneBy: marks.doneBy,
      })
      .from(marks)
      .where(eq(marks.sessionId, s.id)),
    db
      .select({
        agency: agencyStates.agency,
        state: agencyStates.state,
        changedBy: agencyStates.changedBy,
        changedAt: agencyStates.changedAt,
      })
      .from(agencyStates)
      .where(eq(agencyStates.sessionId, s.id)),
  ]);

  const presence = { C1: 0, C2: 0, C3: 0 } as Record<string, number>;
  for (const p of Object.values(s.presence ?? {})) {
    if (p.role in presence) presence[p.role]++;
  }

  return json({
    updatedAt: new Date(s.updated_at).toISOString(),
    contentAt: new Date(s.content_at).toISOString(),
    startedAt: s.started_at ? new Date(s.started_at).toISOString() : null,
    pauses: s.pauses ?? [],
    // Para que cada pantalla corrija el desfase de su reloj.
    serverNow: new Date(s.server_now).toISOString(),
    marks: markRows,
    agencies: agencyRows,
    presence,
  });
}
