export type Vars = Record<string, string>;
export type Role = "C1" | "C2" | "C3";
export const ROLES: Role[] = ["C1", "C2", "C3"];

export interface Session {
  id: string;
  code: string;
  name: string;
  vars: Vars;
  createdAt: string;
  resetAt: string | null;
}

export interface Flight {
  id: string;
  callsign: string;
  idx: number;
  vars: Vars;
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
}

export interface Mark {
  stepId: string;
  flightId: string | null;
  doneAt: string;
  doneBy: string;
}

export interface SessionData {
  session: Session;
  flights: Flight[];
  steps: Step[];
}

export interface StateData {
  updatedAt: string;
  contentAt: string;
  marks: Mark[];
  presence: Record<Role, number>;
}
