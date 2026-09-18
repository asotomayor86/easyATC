/**
 * Archivo de misión: variables, vuelos y guion en el formato de guion.json
 * (campos en español). Sirve para exportar/importar versiones de la misión y
 * para sembrar sesiones nuevas.
 */
import { GUION, type GuionPaso } from "./guion";
import type { Flight, Session, Step } from "./types";

const VAR_KEY = /^[a-z0-9_]{1,40}$/;
const AGENCIES = new Set(GUION.agencias.map((a) => a.id));
const MAX_FLIGHTS = 12;
const MAX_STEPS = 500;

export interface MissionFile {
  exportado?: { sesion: string; nombre: string; fecha: string };
  sesion: Record<string, string>;
  vuelos: Record<string, string>[];
  pasos: GuionPaso[];
  agencias: typeof GUION.agencias;
}

/** Lo que se guarda en la base a partir de un archivo válido. */
export interface ParsedMission {
  vars: Record<string, string>;
  flights: { callsign: string; vars: Record<string, string> }[];
  steps: {
    idx: number;
    phase: number;
    agency: string;
    controller: string;
    scope: string;
    initiator: string;
    pilotText: string | null;
    atcText: string;
    readbackText: string | null;
    eta: string;
    alt: boolean;
    note: string;
    checklist: string;
    counts: boolean;
  }[];
}

export function toMissionFile(session: Session, flights: Flight[], steps: Step[]): MissionFile {
  return {
    exportado: { sesion: session.code, nombre: session.name, fecha: new Date().toISOString() },
    sesion: { ...session.vars },
    vuelos: [...flights].sort((a, b) => a.idx - b.idx).map((f) => ({ ...f.vars })),
    pasos: [...steps]
      .sort((a, b) => a.idx - b.idx)
      .map((s, i) => ({
        orden: i,
        checklist: s.checklist,
        cuenta: s.counts,
        fase: s.phase,
        agencia: s.agency,
        controlador: s.controller,
        ambito: s.scope,
        inicia: s.initiator,
        texto_piloto: s.pilotText,
        texto_atc: s.atcText,
        colacion: s.readbackText,
        hora: s.eta,
        alternativa: s.alt,
        nota: s.note,
      })),
    agencias: GUION.agencias,
  };
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function vars(input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) if (VAR_KEY.test(k)) out[k] = v == null ? "" : String(v);
  return out;
}

const text = (v: unknown) => (v == null ? "" : String(v));
const optionalText = (v: unknown) => (text(v).trim() === "" ? null : text(v));

/** Valida un archivo de misión. El error dice qué falla y dónde. */
export function parseMissionFile(input: unknown): { ok: true; mission: ParsedMission } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error });
  if (!isObject(input)) return fail("El archivo no es un objeto JSON.");
  if (!isObject(input.sesion)) return fail("Falta «sesion» (las variables globales).");
  if (!Array.isArray(input.vuelos) || input.vuelos.length === 0) return fail("Falta «vuelos» o está vacío.");
  if (input.vuelos.length > MAX_FLIGHTS) return fail(`Demasiados vuelos (máximo ${MAX_FLIGHTS}).`);
  if (!Array.isArray(input.pasos) || input.pasos.length === 0) return fail("Falta «pasos» o está vacío.");
  if (input.pasos.length > MAX_STEPS) return fail(`Demasiados pasos (máximo ${MAX_STEPS}).`);

  const flights: ParsedMission["flights"] = [];
  for (const [i, v] of input.vuelos.entries()) {
    if (!isObject(v)) return fail(`vuelo ${i + 1}: no es un objeto.`);
    const fv = vars(v);
    flights.push({ callsign: fv.cs?.trim() || `Vuelo ${i + 1}`, vars: fv });
  }

  const steps: (ParsedMission["steps"][number] & { order: number })[] = [];
  for (const [i, p] of input.pasos.entries()) {
    const where = `paso ${i + 1}`;
    if (!isObject(p)) return fail(`${where}: no es un objeto.`);
    const agency = text(p.agencia);
    if (!AGENCIES.has(agency)) return fail(`${where}: agencia «${agency}» desconocida (${[...AGENCIES].join(", ")}).`);
    const controller = text(p.controlador);
    if (!/^C[123]$/.test(controller)) return fail(`${where}: controlador debe ser C1, C2 o C3.`);
    const scope = text(p.ambito);
    if (scope !== "vuelo" && scope !== "todos") return fail(`${where}: ámbito debe ser «vuelo» o «todos».`);
    const initiator = text(p.inicia);
    if (!["piloto", "atc", "coord"].includes(initiator)) return fail(`${where}: inicia debe ser piloto, atc o coord.`);
    if (typeof p.texto_atc !== "string") return fail(`${where}: falta texto_atc.`);
    const phase = Number(p.fase);
    steps.push({
      order: Number.isFinite(Number(p.orden)) ? Number(p.orden) : i,
      idx: 0,
      phase: Number.isFinite(phase) ? phase : 0,
      agency,
      controller,
      scope,
      initiator,
      pilotText: optionalText(p.texto_piloto),
      atcText: p.texto_atc,
      readbackText: optionalText(p.colacion),
      eta: text(p.hora),
      alt: p.alternativa === true,
      note: text(p.nota),
      checklist: text(p.checklist).trim(),
      counts: p.cuenta !== false,
    });
  }
  // Orden del archivo, renumerado sin huecos.
  steps.sort((a, b) => a.order - b.order);
  const ordered = steps.map(({ order: _o, ...s }, i) => ({ ...s, idx: i }));

  return { ok: true, mission: { vars: vars(input.sesion), flights, steps: ordered } };
}
