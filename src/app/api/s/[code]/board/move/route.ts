import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { AGENCY_LIST } from "@/lib/guion";
import { badRequest, clickTime, json, notFound, UUID_RE } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

const AGENCIES = new Set(AGENCY_LIST.map((a) => a.id));
const ID = /^[a-z0-9_]{1,30}$/;
// Hueco: celda de un stack («norte.fl100»).
const SLOT = /^[a-z0-9_]{1,30}(\.[a-z0-9_]{1,30})?$/;

/**
 * Cuerpo: { agency, flightId, zone, slot, at }. Coloca un vuelo en una zona
 * del tablero de esa agencia (y en un bloque o posición, si la zona los tiene).
 */
export async function POST(req: Request, { params }: Ctx) {
  const { code } = await params;
  const body = await req.json().catch(() => null);
  const agency = String(body?.agency ?? "");
  const flightId = String(body?.flightId ?? "");
  const zone = String(body?.zone ?? "");
  const slot = body?.slot == null ? null : String(body.slot);
  if (!AGENCIES.has(agency)) return badRequest("Agencia desconocida");
  if (!UUID_RE.test(flightId)) return badRequest("Vuelo desconocido");
  if (!ID.test(zone)) return badRequest("Zona no válida");
  if (slot !== null && !SLOT.test(slot)) return badRequest("Bloque o posición no válido");
  const pos = { zone, slot, at: clickTime(body?.at).getTime() };

  const result = await getDb().execute<{ board_state: unknown }>(sql`
    UPDATE sessions SET
      board_state = jsonb_set(board_state, ARRAY[${agency}::text],
        coalesce(board_state->${agency}::text, '{}'::jsonb) || jsonb_build_object(${flightId}::text, ${JSON.stringify(pos)}::jsonb)),
      updated_at = now()
    WHERE code = ${code.toUpperCase()}
    RETURNING board_state
  `);
  if (!result.rows[0]) return notFound();
  return json({ ok: true, pos });
}
