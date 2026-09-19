import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions } from "@/db/schema";

export const ROLE_RE = /^C[123]$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function notFound() {
  return json({ error: "Sesión no encontrada" }, 404);
}

export function badRequest(msg: string) {
  return json({ error: msg }, 400);
}

export async function findSession(code: string) {
  const [row] = await getDb()
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.code, code.toUpperCase()))
    .limit(1);
  return row ?? null;
}

/**
 * Instante en que el usuario pulsó (ISO, ya corregido con la hora del
 * servidor en el cliente). Si falta o se aleja más de 2 minutos de la hora
 * del servidor, se usa la del servidor.
 */
export function clickTime(v: unknown): Date {
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(t) && Math.abs(t - Date.now()) <= 120_000 ? new Date(t) : new Date();
}

/** Orden del plan de vuelo: variable → número entero positivo. null si no es un objeto. */
export function cleanPlanOrder(input: unknown): Record<string, number> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(input)) {
    const n = Number(v);
    if (/^[a-z0-9_]{1,40}$/.test(k) && Number.isInteger(n) && n >= 1 && n <= 500) out[k] = n;
  }
  return out;
}

/** Deja solo pares clave → texto, con claves razonables. */
export function cleanVars(input: unknown): Record<string, string> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    if (!/^[a-z0-9_]{1,40}$/.test(k)) continue;
    out[k] = v == null ? "" : String(v);
  }
  return out;
}
