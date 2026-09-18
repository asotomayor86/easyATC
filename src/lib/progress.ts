import type { Flight, Mark, Role, Step } from "./types";

export interface Row {
  key: string;
  step: Step;
  flight: Flight | null;
}

export const rowKey = (stepId: string, flightId: string | null) => `${stepId}:${flightId ?? "*"}`;

/** Despliega los pasos en filas: una por vuelo si el ámbito es «vuelo», una sola si es «todos». */
export function buildRows(steps: Step[], flights: Flight[]): Row[] {
  const rows: Row[] = [];
  for (const step of steps) {
    if (step.scope === "vuelo") {
      for (const f of flights) rows.push({ key: rowKey(step.id, f.id), step, flight: f });
    } else {
      rows.push({ key: rowKey(step.id, null), step, flight: null });
    }
  }
  return rows;
}

export interface Progress {
  done: number; // ok + warn + ko + na
  ok: number;
  warn: number;
  ko: number;
  na: number;
  total: number;
  pct: number;
  firstPendingKey: string | null;
}

/** Progreso de las filas que cumplan `filter`. Las alternativas no cuentan para el total. */
export function progressOf(rows: Row[], marks: Map<string, Mark>, filter: (r: Row) => boolean): Progress {
  let done = 0;
  let ok = 0;
  let warn = 0;
  let ko = 0;
  let na = 0;
  let total = 0;
  let firstPendingKey: string | null = null;
  for (const r of rows) {
    if (!filter(r)) continue;
    const m = marks.get(r.key);
    // Los contadores incluyen las alternativas: también son transmisiones hechas.
    if (m?.status === "ok") ok++;
    else if (m?.status === "warn") warn++;
    else if (m?.status === "ko") ko++;
    else if (m?.status === "na") na++;
    if (r.step.alt) continue;
    total++;
    if (m) done++;
    else if (!firstPendingKey) firstPendingKey = r.key;
  }
  return { done, ok, warn, ko, na, total, pct: total ? Math.round((done / total) * 100) : 0, firstPendingKey };
}

export const progressForRole = (role: Role, rows: Row[], marks: Map<string, Mark>) =>
  progressOf(rows, marks, (r) => r.step.controller === role);

export interface FlightGroup {
  key: string; // id del vuelo, o "*" para las transmisiones a todos
  flight: Flight | null;
  rows: Row[];
}

/**
 * Agrupa las filas de una agencia por vuelo. Las de ámbito «todos» forman su
 * propio grupo. Los grupos quedan en el orden de su primera transmisión.
 */
export function groupByFlight(rows: Row[]): FlightGroup[] {
  const groups = new Map<string, FlightGroup>();
  for (const r of rows) {
    const key = r.flight?.id ?? "*";
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { key, flight: r.flight, rows: [] }));
    g.rows.push(r);
  }
  return [...groups.values()];
}

export const foldKey = (agency: string, groupKey: string) => `${agency}:${groupKey}`;

export interface AgencyGroup {
  agency: string;
  controller: Role;
  rows: Row[];
}

/** Agrupa las filas por agencia, en el orden en que aparecen (orden de fase). */
export function groupByAgency(rows: Row[]): AgencyGroup[] {
  const groups: AgencyGroup[] = [];
  for (const r of rows) {
    const last = groups[groups.length - 1];
    if (last && last.agency === r.step.agency) last.rows.push(r);
    else groups.push({ agency: r.step.agency, controller: r.step.controller, rows: [r] });
  }
  return groups;
}

export function groupBySteps(rows: Row[]) {
  const out: { step: Step; rows: Row[] }[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last.step.id === r.step.id) last.rows.push(r);
    else out.push({ step: r.step, rows: [r] });
  }
  return out;
}
