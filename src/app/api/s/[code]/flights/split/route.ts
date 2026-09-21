import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { flights, sessions } from "@/db/schema";
import { normalizeBoard } from "@/lib/board";
import { AGENCY_LIST } from "@/lib/guion";
import { badRequest, clickTime, json, notFound, observerBlocked, ROLE_RE, UUID_RE } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

const AGENCIES = new Set(AGENCY_LIST.map((a) => a.id));
const MAX_FLIGHTS = 20;

/**
 * Cuerpo: { flightId, nombre, agency, role, at }. Desprende un vuelo nuevo del
 * indicado: nace sin plan de vuelo (variables vacías), en la entrada de esa
 * agencia y con el color del original. El original no cambia.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { code } = await params;
  const body = await req.json().catch(() => null);
  const blocked = observerBlocked(body?.role);
  if (blocked) return blocked;
  const flightId = typeof body?.flightId === "string" && UUID_RE.test(body.flightId) ? body.flightId : null;
  const nombre = String(body?.nombre ?? "").trim().slice(0, 40);
  const agency = String(body?.agency ?? "");
  const role = typeof body?.role === "string" && ROLE_RE.test(body.role) ? body.role : null;
  if (!flightId) return badRequest("Vuelo desconocido");
  if (!nombre) return badRequest("Falta el indicativo del vuelo nuevo");
  if (!AGENCIES.has(agency)) return badRequest("Agencia desconocida");
  if (!role) return badRequest("Falta role");

  const db = getDb();
  const [session] = await db
    .select({ id: sessions.id, board: sessions.board })
    .from(sessions)
    .where(eq(sessions.code, code.toUpperCase()))
    .limit(1);
  if (!session) return notFound();

  const all = await db
    .select({ id: flights.id, callsign: flights.callsign, idx: flights.idx, vars: flights.vars })
    .from(flights)
    .where(eq(flights.sessionId, session.id))
    .orderBy(asc(flights.idx));
  const parent = all.find((f) => f.id === flightId);
  if (!parent) return badRequest("Vuelo desconocido");
  if (all.length >= MAX_FLIGHTS) return badRequest(`No caben más de ${MAX_FLIGHTS} vuelos`);
  if (all.some((f) => f.callsign.toLowerCase() === nombre.toLowerCase()))
    return badRequest(`Ya hay un vuelo llamado «${nombre}»`);

  const at = clickTime(body?.at);
  const [created] = await db
    .insert(flights)
    .values({
      sessionId: session.id,
      callsign: nombre,
      idx: Math.max(...all.map((f) => f.idx)) + 1,
      vars: {},
      parentId: parent.id,
      createdBy: role,
      createdAt: at,
    })
    .returning({ id: flights.id });

  // El vuelo nuevo nace en la entrada de la agencia donde se dividió.
  const board = normalizeBoard(session.board);
  const entrada = (board.zonas[agency] ?? []).find((z) => z.tipo === "entrada");
  const pos = entrada ? { zone: entrada.id, slot: null, at: at.getTime() } : null;
  // Hereda el color del original (las fichas del tablero se identifican por su nombre corto).
  const key = (parent.vars.corto || parent.callsign).toUpperCase();
  const color = board.colores?.find((c) => c.vuelo === key)?.color;
  const colores = color ? [...(board.colores ?? []), { vuelo: nombre.toUpperCase(), color }] : board.colores;

  await db.execute(sql`
    UPDATE sessions SET
      board_state = ${pos ? sql`jsonb_set(board_state, ARRAY[${agency}::text],
        coalesce(board_state->${agency}::text, '{}'::jsonb) || jsonb_build_object(${created.id}::text, ${JSON.stringify(pos)}::jsonb))` : sql`board_state`},
      board = ${colores ? sql`jsonb_set(board, '{colores}', ${JSON.stringify(colores)}::jsonb)` : sql`board`},
      updated_at = now(), content_at = now()
    WHERE id = ${session.id}
  `);

  return json({ ok: true, id: created.id });
}
