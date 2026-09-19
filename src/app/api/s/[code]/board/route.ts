import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions } from "@/db/schema";
import { parseBoardFile, validateColors, validateZones } from "@/lib/board";
import { AGENCY_LIST } from "@/lib/guion";
import { badRequest, json, notFound } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

const AGENCIES = new Set(AGENCY_LIST.map((a) => a.id));

/**
 * Cuerpo, una de tres:
 * - { agency, zonas }: sustituye las zonas de una agencia (solo esa).
 * - { colores }: sustituye los colores de los vuelos.
 * - { file }: importa un archivo con el formato de zonas.json (todo el tablero).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const { code } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Cuerpo inválido");
  const where = sql`code = ${code.toUpperCase()}`;
  let update;

  if ("file" in body) {
    const r = parseBoardFile(body.file);
    if (!r.ok) return badRequest(r.error);
    update = sql`board = ${JSON.stringify(r.value)}::jsonb`;
  } else if ("agency" in body) {
    const agency = String(body.agency);
    if (!AGENCIES.has(agency)) return badRequest("Agencia desconocida");
    const r = validateZones(body.zonas, agency);
    if (!r.ok) return badRequest(r.error);
    // Solo cambia esa agencia: dos personas pueden editar agencias distintas a la vez.
    update = sql`board = jsonb_set(board, '{zonas}',
      coalesce(board->'zonas', '{}'::jsonb) || jsonb_build_object(${agency}::text, ${JSON.stringify(r.value)}::jsonb))`;
  } else if ("colores" in body) {
    const r = validateColors(body.colores);
    if (!r.ok) return badRequest(r.error);
    update = sql`board = jsonb_set(board, '{colores}', ${JSON.stringify(r.value)}::jsonb)`;
  } else {
    return badRequest("Nada que guardar");
  }

  const result = await getDb().execute<{ board: unknown }>(sql`
    UPDATE ${sessions} SET ${update}, content_at = now() WHERE ${where} RETURNING board
  `);
  if (!result.rows[0]) return notFound();
  return json({ ok: true, board: result.rows[0].board });
}
