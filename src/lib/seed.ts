import { eq, sql } from "drizzle-orm";
import type { getDb } from "@/db";
import { sessions, flights, steps } from "@/db/schema";
import { GUION } from "./guion";
import zonas from "../../zonas.json";
import { parseBoardFile } from "./board";
import { parseMissionFile, type ParsedMission } from "./missionFile";

type DB = ReturnType<typeof getDb>;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

/** Inserciones de vuelos y pasos de una misión ya validada, para usar en un batch. */
export function missionInserts(db: DB, sessionId: string, mission: ParsedMission) {
  return [
    db.insert(flights).values(mission.flights.map((f, i) => ({ sessionId, callsign: f.callsign, idx: i, vars: f.vars }))),
    db.insert(steps).values(mission.steps.map((st) => ({ sessionId, ...st }))),
  ] as const;
}

/**
 * Crea una sesión con una copia completa de guion.json (o de la misión que se
 * le pase). Devuelve el código.
 */
export async function createSession(db: DB, name: string, fixedCode?: string, from?: ParsedMission): Promise<string> {
  let mission = from;
  if (!mission) {
    const parsed = parseMissionFile(GUION);
    if (!parsed.ok) throw new Error(`guion.json no es válido: ${parsed.error}`);
    mission = parsed.mission;
  }
  const board = parseBoardFile(zonas);
  if (!board.ok) throw new Error(`zonas.json no es válido: ${board.error}`);

  let row: { id: string; code: string } | undefined;
  for (let attempt = 0; attempt < 5 && !row; attempt++) {
    const code = fixedCode ?? randomCode();
    [row] = await db
      .insert(sessions)
      .values({
        code,
        name,
        vars: mission.vars,
        board: board.value,
        planOrder: mission.planOrder ?? {},
        varOrder: mission.varOrder ?? [],
        flightsBase: mission.flights.map((f) => ({ callsign: f.callsign, vars: f.vars })),
      })
      .onConflictDoNothing()
      .returning({ id: sessions.id, code: sessions.code });
    if (fixedCode) break;
  }
  if (!row) throw new Error("No se pudo generar un código libre");

  await db.batch(missionInserts(db, row.id, mission));
  return row.code;
}

/**
 * Crea la sesión si no existe. Si ya existe no la toca: el guion de una
 * sesión se edita desde la app (textos, pasos añadidos o quitados), y volver a
 * sembrarla borraría esos cambios y sus marcas. Para recargar DEMO01 desde
 * guion.json está `npm run db:seed`.
 */
export async function ensureSession(db: DB, code: string, name: string): Promise<"creada" | "ya existía"> {
  const [existing] = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.code, code)).limit(1);
  if (existing) return "ya existía";
  await createSession(db, name, code);
  return "creada";
}

/**
 * Pone zonas.json como tablero en las sesiones que aún no tienen ninguna zona
 * (las creadas antes de existir el tablero). No toca un tablero ya editado.
 */
export async function fillEmptyBoards(db: DB): Promise<number> {
  const board = parseBoardFile(zonas);
  if (!board.ok) throw new Error(`zonas.json no es válido: ${board.error}`);
  const r = await db
    .update(sessions)
    .set({ board: board.value })
    .where(sql`${sessions.board}->'zonas' = '{}'::jsonb`)
    .returning({ code: sessions.code });
  return r.length;
}

export async function deleteSessionByCode(db: DB, code: string) {
  await db.delete(sessions).where(eq(sessions.code, code));
}
