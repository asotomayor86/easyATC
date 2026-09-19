/**
 * Tablero: zonas de cada agencia (entrada, stack, secuencia, salida) por las
 * que se siguen los vuelos durante el ejercicio. Es solo seguimiento visual:
 * nunca cambia el texto de las comunicaciones, que siempre salen del plan de
 * vuelo publicado (guion + variables). El archivo de intercambio es zonas.json.
 */
import { AGENCY_LIST } from "./guion";

export type ZoneKind = "entrada" | "stack" | "secuencia" | "salida";

export interface Zone {
  /** Se genera del nombre al crear la zona y no cambia: lo usan los enlaces («AGENCIA.id»). */
  id: string;
  nombre: string;
  tipo: ZoneKind;
  /** entrada: salida de otra agencia de la que vienen los vuelos («ROD.sal»). */
  origen?: string | null;
  /** salida: entrada de otra agencia a la que pasan los vuelos («TWR.ent»). */
  destino?: string | null;
  /** stack: puntos (columnas) y bloques (filas); la rejilla es su producto cartesiano. */
  puntos?: string[];
  bloques?: string[];
  /** stack: celdas desactivadas, como «este.fl080». */
  excluidos?: string[];
}

/** Dónde está un vuelo dentro del tablero de una agencia. */
export interface BoardPos {
  zone: string;
  /** «punto.bloque» en un stack; null en las demás zonas. */
  slot: string | null;
  /** Instante en que se colocó: ordena los vuelos dentro de la zona. */
  at: number;
}

/** Agencia → vuelo → posición. Un vuelo sin posición está en la entrada de la agencia. */
export type BoardState = Record<string, Record<string, BoardPos>>;

export interface Board {
  zonas: Record<string, Zone[]>;
  colores?: { vuelo: string; color: string }[];
}

export const ZONE_KINDS: { kind: ZoneKind; label: string; hint: string }[] = [
  { kind: "entrada", label: "Entrada", hint: "Donde llegan los vuelos, o de donde parten." },
  { kind: "stack", label: "Stack", hint: "Rejilla de puntos (Norte, Este…) por bloques (FL080, FL090…)." },
  { kind: "secuencia", label: "Secuencia", hint: "Vuelos numerados 1.º, 2.º… por orden de llegada, como una salida." },
  { kind: "salida", label: "Salida", hint: "Donde se entregan los vuelos a otra agencia, en orden." },
];

export const FLIGHT_COLORS: Record<string, string> = {
  blue: "#4f86d9",
  green: "#3fae63",
  violet: "#9a6fe0",
  orange: "#e08a3c",
  red: "#d0564d",
  yellow: "#e2c33a",
  cyan: "#3bb6c9",
  pink: "#d965a8",
};

const ZONE_ID = /^[a-z0-9_]{1,30}$/;
const REF = /^[A-Z0-9]{1,10}\.[a-z0-9_]{1,30}$/;
const MAX_ZONES = 40;
const MAX_ITEMS = 30;
const AGENCIES = new Set(AGENCY_LIST.map((a) => a.id));

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number) => (v == null ? "" : String(v)).slice(0, max);

/** «Punto Norte» → «punto_norte»: identificador sin tildes, mayúsculas ni espacios. */
export function toSlug(s: string, max = 30) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, max);
}

/** Celda de un stack: «norte.fl100». */
export const stackCell = (punto: string, bloque: string) => `${toSlug(punto)}.${toSlug(bloque)}`;

function parseRef(v: unknown, where: string, field: string): Result<string | null> {
  if (v == null || v === "") return { ok: true, value: null };
  const s = String(v);
  return REF.test(s) ? { ok: true, value: s } : { ok: false, error: `${where}: ${field} «${s}» no tiene la forma AGENCIA.zona.` };
}

/** Lista de nombres sin vacíos ni repetidos (por su identificador). */
function parseNames(v: unknown, where: string, what: string): Result<string[]> {
  if (!Array.isArray(v)) return { ok: true, value: [] };
  if (v.length > MAX_ITEMS) return { ok: false, error: `${where}: demasiados ${what} (máximo ${MAX_ITEMS}).` };
  const out: string[] = [];
  for (const item of v) {
    const name = str(item, 40).trim();
    if (!toSlug(name)) continue;
    if (out.some((x) => toSlug(x) === toSlug(name))) return { ok: false, error: `${where}: «${name}» está repetido en ${what}.` };
    out.push(name);
  }
  return { ok: true, value: out };
}

/**
 * Stack a partir de cualquiera de los formatos que ha tenido:
 * - actual: puntos y bloques como listas de nombres, más celdas excluidas;
 * - puntos con sus propios bloques ([{ nombre, bloques: [{ etiqueta }] }]);
 * - bloques sueltos ([{ etiqueta }]), como en el primer zonas.json.
 */
function parseStack(z: Record<string, unknown>, where: string): Result<Pick<Zone, "puntos" | "bloques" | "excluidos">> {
  const objects = (v: unknown): v is Record<string, unknown>[] => Array.isArray(v) && v.some(isObject);
  let puntosIn: unknown = z.puntos;
  let bloquesIn: unknown = z.bloques;
  let excluidosIn: unknown = z.excluidos;
  if (objects(z.puntos)) {
    const pts = z.puntos.filter(isObject).map((p) => ({
      nombre: str(p.nombre || p.id, 40),
      bloques: (Array.isArray(p.bloques) ? p.bloques : []).filter(isObject).map((b) => str(b.etiqueta || b.id, 40)),
    }));
    puntosIn = pts.map((p) => p.nombre);
    const all: string[] = [];
    for (const p of pts) for (const b of p.bloques) if (!all.some((x) => toSlug(x) === toSlug(b))) all.push(b);
    bloquesIn = all;
    excluidosIn = pts.flatMap((p) => all.filter((b) => !p.bloques.some((x) => toSlug(x) === toSlug(b))).map((b) => stackCell(p.nombre, b)));
  } else if (objects(z.bloques)) {
    puntosIn = [str(z.nombre, 40) || "Punto"];
    bloquesIn = z.bloques.filter(isObject).map((b) => str(b.etiqueta || b.id, 40));
    excluidosIn = [];
  }
  const puntos = parseNames(puntosIn, where, "puntos");
  if (!puntos.ok) return puntos;
  const bloques = parseNames(bloquesIn, where, "bloques");
  if (!bloques.ok) return bloques;
  const cells = new Set(puntos.value.flatMap((p) => bloques.value.map((b) => stackCell(p, b))));
  const excluidos = (Array.isArray(excluidosIn) ? excluidosIn : []).map(String).filter((c) => cells.has(c));
  return { ok: true, value: { puntos: puntos.value, bloques: bloques.value, excluidos: [...new Set(excluidos)] } };
}

/** Valida las zonas de una agencia (y convierte formatos antiguos). */
export function validateZones(input: unknown, agency: string): Result<Zone[]> {
  if (!Array.isArray(input)) return { ok: false, error: `${agency}: «zonas» debe ser una lista.` };
  if (input.length > MAX_ZONES) return { ok: false, error: `${agency}: demasiadas zonas (máximo ${MAX_ZONES}).` };
  const ids = new Set<string>();
  const zones: Zone[] = [];
  for (const [i, z] of input.entries()) {
    const where = `${agency}, zona ${i + 1}`;
    if (!isObject(z)) return { ok: false, error: `${where}: no es un objeto.` };
    const id = String(z.id ?? "");
    if (!ZONE_ID.test(id)) return { ok: false, error: `${where}: id «${id}» no válido (minúsculas, números y _).` };
    if (ids.has(id)) return { ok: false, error: `${where}: id «${id}» repetido.` };
    ids.add(id);
    const tipo = z.tipo as ZoneKind;
    if (!ZONE_KINDS.some((k) => k.kind === tipo)) return { ok: false, error: `${where}: tipo «${String(z.tipo)}» desconocido.` };
    const zone: Zone = { id, nombre: str(z.nombre, 80), tipo };

    if (tipo === "entrada") {
      const r = parseRef(z.origen, where, "origen");
      if (!r.ok) return r;
      zone.origen = r.value;
    } else if (tipo === "salida") {
      const r = parseRef(z.destino, where, "destino");
      if (!r.ok) return r;
      zone.destino = r.value;
    } else if (tipo === "stack") {
      const r = parseStack(z, where);
      if (!r.ok) return r;
      Object.assign(zone, r.value);
    }
    // secuencia: no tiene nada que configurar (las «posiciones» de formatos anteriores se ignoran).
    zones.push(zone);
  }
  return { ok: true, value: zones };
}

export function validateColors(input: unknown): Result<{ vuelo: string; color: string }[]> {
  if (!Array.isArray(input) || input.length > 20) return { ok: false, error: "«colores» debe ser una lista." };
  const out: { vuelo: string; color: string }[] = [];
  for (const c of input) {
    if (!isObject(c)) return { ok: false, error: "Cada color debe ser un objeto { vuelo, color }." };
    const color = String(c.color ?? "");
    if (!(color in FLIGHT_COLORS)) return { ok: false, error: `Color «${color}» desconocido (${Object.keys(FLIGHT_COLORS).join(", ")}).` };
    out.push({ vuelo: str(c.vuelo, 30).toUpperCase(), color });
  }
  return { ok: true, value: out };
}

/** Valida un archivo con el formato de zonas.json (también los formatos anteriores). */
export function parseBoardFile(input: unknown): Result<Board> {
  if (!isObject(input)) return { ok: false, error: "El archivo no es un objeto JSON." };
  if (!Array.isArray(input.tableros)) return { ok: false, error: "Falta «tableros»." };
  const zonas: Record<string, Zone[]> = {};
  for (const t of input.tableros) {
    if (!isObject(t)) return { ok: false, error: "Cada tablero debe ser un objeto." };
    const agency = String(t.agencia ?? "");
    if (!AGENCIES.has(agency)) return { ok: false, error: `Agencia «${agency}» desconocida.` };
    const r = validateZones(t.zonas ?? [], agency);
    if (!r.ok) return r;
    zonas[agency] = r.value;
  }
  const board: Board = { zonas };
  if (input.colores != null) {
    const c = validateColors(input.colores);
    if (!c.ok) return c;
    board.colores = c.value;
  }
  return { ok: true, value: board };
}

/** Referencias «AGENCIA.zona» de todas las zonas de un tipo, en orden de fase. */
export function zoneRefs(board: Board, tipo: ZoneKind): { ref: string; label: string }[] {
  return AGENCY_LIST.flatMap((a) =>
    (board.zonas[a.id] ?? []).filter((z) => z.tipo === tipo).map((z) => ({ ref: `${a.id}.${z.id}`, label: `${a.id} · ${z.nombre || z.id}` })),
  );
}

/** Exporta en el formato de zonas.json. */
export function toBoardFile(board: Board) {
  return {
    version: 2,
    tableros: AGENCY_LIST.map((a) => ({ agencia: a.id, nombre: a.nombre, controlador: a.controlador, zonas: board.zonas[a.id] ?? [] })),
    colores: board.colores ?? [],
  };
}

/** Zona nueva con un id libre dentro de la agencia. */
export function newZone(tipo: ZoneKind, nombre: string, taken: string[]): Zone {
  const base = toSlug(nombre, 24) || tipo;
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}_${n}`;
  const zone: Zone = { id, nombre: nombre || ZONE_KINDS.find((k) => k.kind === tipo)!.label, tipo };
  if (tipo === "entrada") zone.origen = null;
  if (tipo === "salida") zone.destino = null;
  if (tipo === "stack") Object.assign(zone, { puntos: [], bloques: [], excluidos: [] });
  return zone;
}

// --- Colocación de los vuelos en el tablero de una agencia -------------------

export const slotKey = (zone: string, slot: string | null) => `${zone}|${slot ?? ""}`;

/** Hueco para los vuelos de una agencia sin ninguna entrada. */
export const POOL_ZONE = "__sin_ubicar";

export interface PlacedFlight {
  flightId: string;
  at: number;
}

export interface AgencyLayout {
  /** Hueco («zona|bloque») → vuelos por orden de llegada. */
  slots: Record<string, PlacedFlight[]>;
  /** Entradas que heredan de la salida de otra agencia: no se pueden editar. */
  inherited: Record<string, { agency: string; zone: string; name: string }>;
}

function validPos(zones: Zone[], p: BoardPos | undefined): p is BoardPos {
  const z = p && zones.find((x) => x.id === p.zone);
  if (!z || !p) return false;
  if (z.tipo === "stack") return p.slot !== null && stackCells(z).includes(p.slot);
  return p.slot === null;
}

/** Celdas activas de un stack (todas las combinaciones punto × bloque salvo las excluidas). */
export function stackCells(z: Zone): string[] {
  const off = new Set(z.excluidos ?? []);
  return (z.puntos ?? []).flatMap((p) => (z.bloques ?? []).map((b) => stackCell(p, b))).filter((c) => !off.has(c));
}

/** Salida de otra agencia de la que hereda esta entrada (por su «origen» o por el «destino» de la salida). */
function upstreamOf(agency: string, entrada: Zone, zonas: Record<string, Zone[]>) {
  const pointing = Object.entries(zonas).flatMap(([a, zs]) =>
    zs.filter((z) => z.tipo === "salida" && z.destino === `${agency}.${entrada.id}`).map((z) => `${a}.${z.id}`),
  );
  const ref = entrada.origen ?? pointing[0];
  if (!ref) return null;
  const [a, id] = ref.split(".");
  const zone = zonas[a]?.find((z) => z.id === id && z.tipo === "salida");
  return zone && a !== agency ? { agency: a, zone } : null;
}

/**
 * Dónde está cada vuelo en el tablero de una agencia:
 * 1. Si la agencia lo ha colocado en una de sus zonas (salvo una entrada heredada), ahí.
 * 2. Si no, si está en la salida de la que hereda una de sus entradas, en esa
 *    entrada y con el mismo orden que en la salida.
 * 3. Si no, en su primera entrada sin herencia (el punto de partida), o en
 *    «sin ubicar» si la agencia no tiene entradas. Si todas sus entradas
 *    heredan, el vuelo todavía no ha llegado y no aparece.
 */
export function layoutAgency(
  agency: string,
  zonas: Record<string, Zone[]>,
  state: BoardState,
  flightIds: string[],
): AgencyLayout {
  const zones = zonas[agency] ?? [];
  const own = state[agency] ?? {};
  const entradas = zones.filter((z) => z.tipo === "entrada");
  const inherited: AgencyLayout["inherited"] = {};
  const links: { entrada: string; agency: string; salida: string }[] = [];
  for (const e of entradas) {
    const up = upstreamOf(agency, e, zonas);
    if (up) {
      inherited[e.id] = { agency: up.agency, zone: up.zone.id, name: up.zone.nombre || up.zone.id };
      links.push({ entrada: e.id, agency: up.agency, salida: up.zone.id });
    }
  }
  const home = entradas.find((e) => !inherited[e.id])?.id ?? (entradas.length === 0 ? POOL_ZONE : null);

  const slots: AgencyLayout["slots"] = {};
  const put = (key: string, flightId: string, at: number) => (slots[key] ??= []).push({ flightId, at });
  for (const id of flightIds) {
    const p = own[id];
    if (validPos(zones, p) && !inherited[p.zone]) {
      put(slotKey(p.zone, p.slot), id, p.at);
      continue;
    }
    const link = links.find((l) => {
      const up = state[l.agency]?.[id];
      return up?.zone === l.salida && up.slot === null;
    });
    if (link) put(slotKey(link.entrada, null), id, state[link.agency][id].at);
    else if (home) put(slotKey(home, null), id, 0);
  }
  for (const list of Object.values(slots)) list.sort((a, b) => a.at - b.at);
  return { slots, inherited };
}

/** Tablero guardado → formato actual (convierte stacks y secuencias de formatos anteriores). */
export function normalizeBoard(input: unknown): Board {
  const b = isObject(input) ? input : {};
  const zonas: Record<string, Zone[]> = {};
  for (const [agency, zs] of Object.entries(isObject(b.zonas) ? b.zonas : {})) {
    const r = validateZones(zs, agency);
    if (r.ok) zonas[agency] = r.value;
  }
  const colores = validateColors(b.colores ?? []);
  return { zonas, colores: colores.ok ? colores.value : [] };
}
