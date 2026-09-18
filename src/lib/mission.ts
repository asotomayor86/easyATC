/**
 * Reloj de misión: la hora de la variable `inicio_mision` (la hora de DCS al
 * quitar la pausa) más el tiempo real transcurrido desde que se pulsó Inicio.
 */

/** "09:00", "0900", "9.00", "09:00:00" → segundos desde medianoche. */
export function parseClock(value: string | undefined): number | null {
  const m = value?.trim().match(/^(\d{1,2})[:.h]?(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const [h, min, s] = [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
  if (h > 23 || min > 59 || s > 59) return null;
  return h * 3600 + min * 60 + s;
}

const pad = (n: number) => String(n).padStart(2, "0");

function hms(total: number) {
  const t = Math.max(0, Math.floor(total));
  return `${pad(Math.floor(t / 3600))}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`;
}

/**
 * Hora de misión de un instante real. Sin `inicio_mision` devuelve el tiempo
 * transcurrido («T+00:12:34»).
 */
export function missionTime(at: number, startedAt: number, base: number | null): string {
  const elapsed = (at - startedAt) / 1000;
  if (base === null) return `T+${hms(elapsed)}`;
  return hms((base + elapsed) % 86400);
}
