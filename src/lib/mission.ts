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

export interface Pause {
  from: string;
  to: string | null;
}

export const isPaused = (pauses: Pause[]) => pauses.length > 0 && pauses[pauses.length - 1].to === null;

/** Milisegundos en pausa entre el inicio y el instante `at` (solo las pausas anteriores cuentan). */
function pausedMs(pauses: Pause[], startedAt: number, at: number) {
  let total = 0;
  for (const p of pauses) {
    const from = Math.max(new Date(p.from).getTime(), startedAt);
    const to = Math.min(p.to ? new Date(p.to).getTime() : at, at);
    if (to > from) total += to - from;
  }
  return total;
}

/**
 * Hora de misión de un instante real: la hora de partida más el tiempo en
 * marcha, sin contar las pausas. Sin `inicio_mision` devuelve el tiempo
 * transcurrido («T+00:12:34»).
 */
export function missionTime(at: number, startedAt: number, base: number | null, pauses: Pause[] = []): string {
  const elapsed = Math.max(0, (at - startedAt - pausedMs(pauses, startedAt, at)) / 1000);
  if (base === null) return `T+${hms(elapsed)}`;
  return hms((base + elapsed) % 86400);
}
