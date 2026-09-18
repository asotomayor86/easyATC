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
  done: number;
  total: number;
  pct: number;
  currentAgency: string | null;
  firstPendingKey: string | null;
}

export function progressFor(role: Role, rows: Row[], marks: Map<string, Mark>): Progress {
  let done = 0;
  let total = 0;
  let firstPending: Row | null = null;
  let lastDone: Row | null = null;
  for (const r of rows) {
    if (r.step.controller !== role || r.step.alt) continue;
    total++;
    if (marks.has(r.key)) {
      done++;
      lastDone = r;
    } else if (!firstPending) firstPending = r;
  }
  return {
    done,
    total,
    pct: total ? Math.round((done / total) * 100) : 0,
    currentAgency: (firstPending ?? lastDone)?.step.agency ?? null,
    firstPendingKey: firstPending?.key ?? null,
  };
}
