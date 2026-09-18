import guion from "../../guion.json";

export interface GuionPaso {
  fase: number;
  agencia: string;
  controlador: string;
  ambito: string;
  inicia: string;
  texto_piloto: string | null;
  texto_atc: string;
  colacion: string | null;
  hora: string;
  alternativa: boolean;
  nota: string;
  orden: number;
  checklist?: string;
  cuenta?: boolean;
}

export interface GuionAgencia {
  id: string;
  nombre: string;
  canal: string;
  controlador: string;
  fase: number;
}

export interface Guion {
  sesion: Record<string, string>;
  vuelos: Record<string, string>[];
  pasos: GuionPaso[];
  agencias: GuionAgencia[];
}

export const GUION = guion as Guion;

const AGENCIES = new Map(GUION.agencias.map((a) => [a.id, a]));

/** Las nueve agencias en orden de fase. */
export const AGENCY_LIST = [...GUION.agencias].sort((a, b) => a.fase - b.fase);

export function agencyName(id: string): string {
  return AGENCIES.get(id)?.nombre ?? id;
}

/** Canal de la agencia: la variable de sesión `canal_<id>` si existe; si no, el del guion. */
export function agencyChannel(id: string, sessionVars: Record<string, string>): string {
  const key = "canal_" + id.replace(/\d+$/, "").toLowerCase();
  return sessionVars[key] || AGENCIES.get(id)?.canal || "?";
}
