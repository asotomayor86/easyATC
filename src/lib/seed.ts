import { eq } from "drizzle-orm";
import type { getDb } from "@/db";
import { sessions, flights, steps } from "@/db/schema";
import { GUION } from "./guion";

type DB = ReturnType<typeof getDb>;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

/** Crea una sesión con una copia completa del guion. Devuelve el código. */
export async function createSession(db: DB, name: string, fixedCode?: string): Promise<string> {
  let row: { id: string; code: string } | undefined;
  for (let attempt = 0; attempt < 5 && !row; attempt++) {
    const code = fixedCode ?? randomCode();
    [row] = await db
      .insert(sessions)
      .values({ code, name, vars: { ...GUION.sesion } })
      .onConflictDoNothing()
      .returning({ id: sessions.id, code: sessions.code });
    if (fixedCode) break;
  }
  if (!row) throw new Error("No se pudo generar un código libre");
  const sessionId = row.id;

  await db.batch([
    db.insert(flights).values(
      GUION.vuelos.map((v, i) => ({
        sessionId,
        callsign: v.cs ?? `Vuelo ${i + 1}`,
        idx: i,
        vars: { ...v },
      })),
    ),
    db.insert(steps).values(
      GUION.pasos.map((p) => ({
        sessionId,
        idx: p.orden,
        phase: p.fase,
        agency: p.agencia,
        controller: p.controlador,
        scope: p.ambito,
        initiator: p.inicia,
        pilotText: p.texto_piloto,
        atcText: p.texto_atc,
        readbackText: p.colacion,
        eta: p.hora ?? "",
        alt: !!p.alternativa,
        note: p.nota ?? "",
      })),
    ),
  ]);

  return row.code;
}

export async function deleteSessionByCode(db: DB, code: string) {
  await db.delete(sessions).where(eq(sessions.code, code));
}
