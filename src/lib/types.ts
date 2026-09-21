import type { Board, BoardState } from "./board";

export type Vars = Record<string, string>;
export type Role = "C1" | "C2" | "C3";
export const ROLES: Role[] = ["C1", "C2", "C3"];
/** Puesto desde el que se mira la sesión: los tres controladores y el observador. */
export const OBSERVER = "OBS";
export type Seat = Role | typeof OBSERVER;
export const isObserver = (seat: Seat | null): boolean => seat === OBSERVER;

export interface Session {
  id: string;
  code: string;
  name: string;
  vars: Vars;
  createdAt: string;
  resetAt: string | null;
  board: Board;
  /** Orden de las variables en el plan de vuelo impreso; las que no están, no salen. */
  planOrder: Record<string, number>;
  /** Orden en que se listan las variables al configurarlas; manda sobre el número del plan. */
  varOrder: string[];
}

export interface Flight {
  id: string;
  callsign: string;
  idx: number;
  vars: Vars;
  /** Vuelo del que se desprendió, si nació de una división. */
  parentId?: string | null;
  /** Standby: comunicación en pausa con este vuelo, desde cuándo y quién lo puso. */
  standbyAt?: string | null;
  standbyBy?: string | null;
  createdBy?: string | null;
  /** Indicativo que absorbió y cuándo, si hubo una combinación. */
  mergedFrom?: string | null;
  mergedAt?: string | null;
}

export interface Step {
  id: string;
  idx: number;
  phase: number;
  agency: string;
  controller: Role;
  scope: "vuelo" | "todos";
  initiator: "piloto" | "atc" | "coord";
  pilotText: string | null;
  atcText: string;
  readbackText: string | null;
  eta: string;
  alt: boolean;
  note: string;
  checklist: string;
  /** Si cuenta para los rieles y las estadísticas. */
  counts: boolean;
}

export type MarkStatus = "ok" | "warn" | "ko" | "na";
export const MARK_STATUSES: MarkStatus[] = ["ok", "warn", "ko", "na"];

export interface Mark {
  stepId: string;
  flightId: string | null;
  status: MarkStatus;
  doneAt: string;
  doneBy: string;
}

export type AgencyStateName = "cerrada" | "abierta" | "finalizada";
export const AGENCY_STATES: AgencyStateName[] = ["cerrada", "abierta", "finalizada"];

export interface AgencyState {
  agency: string;
  state: AgencyStateName;
  changedBy: string;
  changedAt: string;
}

export interface SessionData {
  session: Session;
  flights: Flight[];
  steps: Step[];
}

export interface Pause {
  from: string;
  to: string | null;
}

export interface StateData {
  updatedAt: string;
  contentAt: string;
  startedAt: string | null;
  pauses: Pause[];
  serverNow: string;
  boardState: BoardState;
  marks: Mark[];
  agencies: AgencyState[];
  presence: Record<Seat, number>;
}
