"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { slotKey, type AgencyLayout, type BoardPos, type Zone } from "@/lib/board";
import { AGENCY_LIST } from "@/lib/guion";
import type { AgencyStateName, Flight } from "@/lib/types";

/** Un movimiento de vuelo: a dónde y con qué orden dentro de la zona. */
export interface Move {
  agency: string;
  flightId: string;
  zone: string;
  slot: string | null;
  at?: number;
}

export interface MenuRequest {
  flight: Flight;
  x: number;
  y: number;
}

const ITEM = "block w-full px-3 py-1.5 text-left text-[13px] text-zinc-200 hover:bg-gold/15 hover:text-zinc-50";
const PANEL = "rounded-[2px] border border-zinc-700 bg-zinc-900 py-1";

/**
 * Menú del botón derecho (o pulsación larga) sobre la ficha de un vuelo:
 * dividir, combinar con otro vuelo de la agencia, o enviar a cualquier hueco
 * del tablero.
 */
export function FlightMenu({
  request,
  agency,
  flights,
  layouts,
  allZones,
  agencyStates,
  current,
  onSplit,
  onMerge,
  onMoves,
  onStandby,
  onClose,
}: {
  request: MenuRequest;
  /** Agencia desde la que se abre el menú (para «combinar con»). */
  agency: string;
  flights: Flight[];
  layouts: Record<string, AgencyLayout>;
  allZones: Record<string, Zone[]>;
  agencyStates: Map<string, AgencyStateName>;
  current: Record<string, { agency: string; pos: BoardPos }>;
  onSplit: (flight: Flight) => void;
  onMerge: (from: Flight, into: Flight) => void;
  onMoves: (moves: Move[]) => void;
  /** Pone o quita el standby: la comunicación con el vuelo queda en pausa. */
  onStandby: (flight: Flight, on: boolean) => void;
  onClose: () => void;
}) {
  const { flight, x, y } = request;
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<"merge" | "send" | null>(null);

  useEffect(() => {
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", away);
    window.addEventListener("keydown", key);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  // Cerca del borde derecho, el menú y sus submenús se abren hacia la izquierda.
  const width = 260;
  const flip = x + width * 2 > window.innerWidth;
  const left = flip ? Math.max(8, x - width) : x;
  const top = Math.min(y, Math.max(8, window.innerHeight - 180));

  /** Vuelos que están ahora en esta agencia, con dónde están. */
  const here = otherFlightsHere(agency, flights, flight.id, layouts, allZones);

  return (
    <div ref={ref} role="menu" className={`fixed z-50 ${PANEL}`} style={{ left, top, width }}>
      <p className="kicker border-b border-zinc-800 px-3 pb-1.5 text-[10px] text-gold">
        {flight.vars.corto || flight.callsign}
      </p>
      <button
        type="button"
        role="menuitem"
        className={`${ITEM} ${flight.standbyAt ? "text-warn" : ""}`}
        onClick={() => onStandby(flight, !flight.standbyAt)}
      >
        {flight.standbyAt ? "Quitar el standby" : "Poner en standby"}
      </button>
      <div className="my-1 border-t border-zinc-800" />
      <button type="button" role="menuitem" className={ITEM} onClick={() => onSplit(flight)}>
        Dividir vuelo…
      </button>

      <SubMenu
        label="Combinar con"
        width={width}
        open={open === "merge"}
        onOpen={() => setOpen("merge")}
        empty={here.length === 0 ? "No hay otros vuelos en esta agencia." : null}
      >
        {here.map((h) => (
          <button key={h.flight.id} type="button" role="menuitem" className={ITEM} onClick={() => onMerge(flight, h.flight)}>
            {h.flight.callsign} <span className="text-zinc-500">({h.where})</span>
          </button>
        ))}
      </SubMenu>

      <SubMenu
        label="Enviar a"
        width={width}
        open={open === "send"}
        onOpen={() => setOpen("send")}
        empty={null}
      >
        {AGENCY_LIST.map((a) => {
          const state = agencyStates.get(a.id) ?? "cerrada";
          const isHere = current[flight.id]?.agency === a.id;
          const entradas = entradasOf(a.id, flight, layouts, allZones);
          const label = `${isHere ? "● " : ""}${a.nombre}`;
          // Con una sola entrada se envía directamente; con varias, a elegir.
          if (entradas.length === 1) {
            return (
              <button
                key={a.id}
                type="button"
                role="menuitem"
                onClick={() => onMoves(entradas[0].moves)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-gold/15 ${
                  state === "cerrada" ? "text-zinc-500" : "text-zinc-200"
                }`}
              >
                <span className="truncate">{label}</span>
                {state === "cerrada" && <span className="kicker shrink-0 text-[9px] text-zinc-500">cerrada</span>}
              </button>
            );
          }
          return (
            <SubMenu
              key={a.id}
              label={label}
              hint={state === "cerrada" ? "cerrada" : undefined}
              dim={state === "cerrada"}
              width={width}
              disabled={entradas.length === 0}
              empty={entradas.length === 0 ? "Esta agencia no tiene entrada." : null}
            >
              {entradas.map((t) => (
                <button key={t.zone} type="button" role="menuitem" className={ITEM} onClick={() => onMoves(t.moves)}>
                  {t.label}
                </button>
              ))}
            </SubMenu>
          );
        })}
      </SubMenu>
    </div>
  );
}

/**
 * Entrada de menú que abre su panel al lado, al pasar el ratón o al pulsarla.
 * El panel se dibuja sobre la página (posición fija) y no dentro del panel
 * anterior: así no lo recorta el scroll de los menús largos.
 */
function SubMenu({
  label,
  hint,
  dim,
  width,
  open: forced,
  onOpen,
  disabled,
  empty,
  children,
}: {
  label: string;
  hint?: string;
  dim?: boolean;
  width: number;
  open?: boolean;
  onOpen?: () => void;
  disabled?: boolean;
  empty: string | null;
  children: React.ReactNode;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [top, setTop] = useState(0);
  const [hover, setHover] = useState(false);
  const open = ((forced ?? false) || hover) && !!rect;

  const show = () => {
    setRect(button.current?.getBoundingClientRect() ?? null);
    setHover(true);
    onOpen?.();
  };

  // A la derecha de la entrada; si no cabe, a su izquierda.
  const right = rect ? rect.right + width + 8 > window.innerWidth : false;
  const left = rect ? (right ? Math.max(8, rect.left - width + 4) : rect.right - 4) : 0;
  const maxHeight = rect ? Math.round(window.innerHeight * 0.6) : 0;

  // Si el panel se sale por abajo, se sube lo justo para que quepa entero.
  useLayoutEffect(() => {
    if (!open || !rect) return;
    const h = panel.current?.offsetHeight ?? 0;
    setTop(Math.max(8, Math.min(rect.top - 4, window.innerHeight - 8 - h)));
  }, [open, rect]);

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={() => setHover(false)}>
      <button
        ref={button}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={show}
        className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-gold/15 ${
          dim ? "text-zinc-500" : "text-zinc-200"
        } ${disabled ? "cursor-default opacity-40" : ""}`}
      >
        <span className="truncate">{label}</span>
        <span className="kicker shrink-0 text-[9px] text-zinc-500">{hint ? `${hint} ▸` : "▸"}</span>
      </button>
      {open && rect && (
        <div ref={panel} role="menu" className={`fixed z-50 overflow-y-auto ${PANEL}`} style={{ left, top, width, maxHeight }}>
          {empty ? <p className="px-3 py-1.5 text-[12px] text-zinc-500">{empty}</p> : children}
        </div>
      )}
    </div>
  );
}

/** Otros vuelos presentes en la agencia, con la zona donde están. */
function otherFlightsHere(
  agency: string,
  flights: Flight[],
  exceptId: string,
  layouts: Record<string, AgencyLayout>,
  allZones: Record<string, Zone[]>,
) {
  const layout = layouts[agency];
  const zones = allZones[agency] ?? [];
  const out: { flight: Flight; where: string }[] = [];
  for (const [key, items] of Object.entries(layout?.slots ?? {})) {
    const [zoneId, slot] = key.split("|");
    const zone = zones.find((z) => z.id === zoneId);
    const where = [zone?.nombre || zoneId, slot ? slot.split(".").join(" · ") : null].filter(Boolean).join(" · ");
    for (const it of items) {
      if (it.flightId === exceptId) continue;
      const f = flights.find((x) => x.id === it.flightId);
      if (f) out.push({ flight: f, where });
    }
  }
  return out;
}

/**
 * Entradas de una agencia: es lo único a lo que se envía un vuelo desde el
 * menú. Luego, dentro de la agencia, su controlador lo reparte donde toque.
 */
function entradasOf(
  agency: string,
  flight: Flight,
  layouts: Record<string, AgencyLayout>,
  allZones: Record<string, Zone[]>,
) {
  return (allZones[agency] ?? [])
    .filter((z) => z.tipo === "entrada")
    .map((z) => {
      const items = (layouts[agency]?.slots[slotKey(z.id, null)] ?? []).filter((i) => i.flightId !== flight.id);
      return {
        zone: z.id,
        label: z.nombre || z.id,
        // Entra al final de la entrada.
        moves: [
          { agency, flightId: flight.id, zone: z.id, slot: null, at: (items[items.length - 1]?.at ?? Date.now()) + 1000 },
        ] as Move[],
      };
    });
}
