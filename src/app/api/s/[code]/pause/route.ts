import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { badRequest, clickTime, json, notFound } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

/**
 * Cuerpo: { action: "pause" | "resume", at }. Pausa o reanuda el reloj de misión
 * en el instante del clic (`at`). Pausar estando ya en
 * pausa (o reanudar sin estarlo) no cambia nada.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { code } = await params;
  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (action !== "pause" && action !== "resume") return badRequest("action debe ser pause o resume");
  const at = clickTime(body?.at).toISOString();

  // En pausa = la última pausa no tiene `to`.
  const paused = sql`(jsonb_array_length(pauses) > 0 AND pauses->-1->>'to' IS NULL)`;
  const update =
    action === "pause"
      ? sql`pauses = CASE WHEN ${paused} THEN pauses
              ELSE pauses || jsonb_build_array(jsonb_build_object('from', ${at}::text, 'to', null)) END`
      : sql`pauses = CASE WHEN ${paused}
              THEN jsonb_set(pauses, ARRAY[(jsonb_array_length(pauses) - 1)::text, 'to'], to_jsonb(${at}::text))
              ELSE pauses END`;

  const result = await getDb().execute<{ pauses: { from: string; to: string | null }[] }>(sql`
    UPDATE sessions SET ${update}, updated_at = now()
    WHERE code = ${code.toUpperCase()} AND started_at IS NOT NULL
    RETURNING pauses
  `);
  const row = result.rows[0];
  if (!row) return notFound();
  return json({ pauses: row.pauses });
}
