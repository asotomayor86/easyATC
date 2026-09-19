"use client";

import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FLIGHT_COLORS,
  POOL_ZONE,
  slotKey,
  stackCell,
  type AgencyLayout,
  type Board,
  type BoardPos,
  type Zone,
} from "@/lib/board";
import { FlightMenu, type MenuRequest, type Move } from "@/components/FlightMenu";
import { FlightPlanCard } from "@/components/FlightPlanCard";
import type { AgencyStateName, Flight, Vars } from "@/lib/types";

/** Dibuja algo por encima de todo, fuera de la tarjeta de la agencia. */
const overlay = (node: React.ReactNode) => (typeof document === "undefined" ? null : createPortal(node, document.body));

/** Color del vuelo según el tablero (clave: nombre corto en mayúsculas). */
export function flightColor(flight: Flight, colores: Board["colores"]) {
  const key = (flight.vars.corto || flight.callsign).toUpperCase();
  const name = colores?.find((c) => c.vuelo === key)?.color;
  return (name && FLIGHT_COLORS[name]) || "#74747c";
}

export type MoveFlight = (flightId: string, zone: string, slot: string | null) => void;

/**
 * Tablero de una agencia en la vista del controlador: sus zonas con los
 * vuelos como pastillas. Se arrastran con ratón o dedo; también se puede
 * tocar una pastilla y luego la zona de destino. Las entradas que heredan de
 * la salida de otra agencia muestran sus vuelos en el mismo orden y no admiten
 * que se suelte nada en ellas; de ellas solo se sacan vuelos.
 */
export const BoardStrip = memo(function BoardStrip({
  zones,
  flights,
  colores,
  sessionVars,
  planOrder,
  layout,
  onMove,
  agency,
  layouts,
  allZones,
  agencyStates,
  current,
  formatTime,
  onMoves,
  onSplit,
  onMerge,
}: {
  zones: Zone[];
  flights: Flight[];
  colores: Board["colores"];
  sessionVars: Vars;
  /** Variables del plan de vuelo (Variables → Plan): se ven al pasar el ratón por una pastilla. */
  planOrder: Record<string, number> | undefined;
  layout: AgencyLayout;
  onMove: MoveFlight;
  /** Agencia de este tablero y colocación de todas, para el menú del vuelo. */
  agency: string;
  layouts: Record<string, AgencyLayout>;
  allZones: Record<string, Zone[]>;
  agencyStates: Map<string, AgencyStateName>;
  /** Dónde está ahora cada vuelo. */
  current: Record<string, { agency: string; pos: BoardPos }>;
  formatTime: (iso: string) => string;
  onMoves: (moves: Move[]) => void;
  onSplit: (flight: Flight) => void;
  onMerge: (from: Flight, into: Flight) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  // Pastilla bajo el ratón: muestra la ficha con el plan de vuelo.
  const [hover, setHover] = useState<{ id: string; left: number; bottom: number } | null>(null);
  // Menú del botón derecho sobre una pastilla: enviar el vuelo a otra posición.
  const [menu, setMenu] = useState<MenuRequest | null>(null);
  // Pulsación larga en táctil: equivale al botón derecho.
  const longPress = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const start = useRef<{ id: string; x: number; y: number; dragging: boolean } | null>(null);
  const root = useRef<HTMLDivElement>(null);

  if (zones.length === 0) return null;
  const byId = new Map(flights.map((f) => [f.id, f]));
  const itemsAt = (key: string) =>
    (layout.slots[key] ?? []).map((p) => byId.get(p.flightId)).filter((f): f is Flight => !!f);
  const colorOf = (f: Flight) => flightColor(f, colores);

  /** Hueco bajo el puntero, solo dentro de este tablero. */
  const targetAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop]");
    return el && root.current?.contains(el) ? (el.dataset.drop ?? null) : null;
  };

  const moveTo = (id: string, key: string) => {
    const [zone, slot] = key.split("|");
    onMove(id, zone, slot || null);
    setSelected(null);
  };

  const pill = (f: Flight, index?: number) => {
    const color = colorOf(f);
    const isSelected = selected === f.id;
    const isDragged = drag?.id === f.id;
    return (
      <span
        key={f.id}
        aria-label={`${f.callsign}: arrastra o toca para mover`}
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return;
          const r = e.currentTarget.getBoundingClientRect();
          setHover({ id: f.id, left: r.left, bottom: r.bottom });
        }}
        onPointerLeave={() => setHover(null)}
        onContextMenu={(e) => {
          e.preventDefault();
          setHover(null);
          setSelected(null);
          setMenu({ flight: f, x: e.clientX, y: e.clientY });
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          setHover(null);
          e.stopPropagation();
          start.current = { id: f.id, x: e.clientX, y: e.clientY, dragging: false };
          e.currentTarget.setPointerCapture(e.pointerId);
          if (e.pointerType !== "mouse") {
            const { clientX, clientY } = e;
            clearTimeout(longPress.current);
            longPress.current = setTimeout(() => {
              start.current = null;
              navigator.vibrate?.(15);
              setMenu({ flight: f, x: clientX, y: clientY });
            }, 500);
          }
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          if (!s.dragging && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 6) return;
          clearTimeout(longPress.current);
          s.dragging = true;
          setDrag({ id: s.id, x: e.clientX, y: e.clientY });
          setOver(targetAt(e.clientX, e.clientY));
        }}
        onPointerUp={(e) => {
          clearTimeout(longPress.current);
          const s = start.current;
          start.current = null;
          if (!s) return;
          if (s.dragging) {
            const key = targetAt(e.clientX, e.clientY);
            if (key) moveTo(s.id, key);
          } else {
            setSelected((cur) => (cur === s.id ? null : s.id));
          }
          setDrag(null);
          setOver(null);
        }}
        onPointerCancel={() => {
          clearTimeout(longPress.current);
          start.current = null;
          setDrag(null);
          setOver(null);
        }}
        // El toque sobre la pastilla la selecciona; no debe llegar a la zona de debajo.
        onClick={(e) => e.stopPropagation()}
        className={`inline-flex cursor-grab touch-none items-center gap-1.5 rounded-full border px-2.5 py-[3px] font-cond text-[14px] leading-none font-semibold text-zinc-50 select-none ${
          isSelected ? "ring-2 ring-gold ring-offset-1 ring-offset-zinc-950" : ""
        } ${isDragged ? "opacity-30" : ""}`}
        style={{
          borderColor: color,
          // Los vuelos nacidos de una división llevan un rayado diagonal del mismo color.
          background: f.parentId
            ? `repeating-linear-gradient(45deg, ${color}22 0 5px, ${color}66 5px 10px)`
            : `${color}2e`,
        }}
      >
        {index !== undefined && <span className="text-[11px] text-zinc-300">{index}º</span>}
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {f.vars.corto || f.callsign}
      </span>
    );
  };

  /** Hueco donde se pueden soltar vuelos. */
  const drop = (zone: string, slot: string | null, opts: { numbered?: boolean; minH?: string } = {}) => {
    const key = slotKey(zone, slot);
    const items = itemsAt(key);
    const isOver = over === key;
    return (
      <div
        data-drop={key}
        onClick={() => selected && moveTo(selected, key)}
        className={`tint flex min-w-0 flex-1 flex-wrap content-start items-center gap-1.5 rounded-[2px] border border-dashed px-1.5 py-1 ${
          opts.minH ?? "min-h-[30px]"
        } ${
          isOver
            ? "border-gold bg-gold/15"
            : selected
              ? "cursor-pointer border-zinc-500 hover:border-gold hover:bg-gold/10"
              : "border-zinc-800"
        }`}
      >
        {items.map((f, i) => pill(f, opts.numbered ? i + 1 : undefined))}
      </div>
    );
  };

  /** Entrada heredada: los vuelos de la salida anterior, en su orden. No se puede soltar nada en ella. */
  const inheritedList = (zone: string, from: AgencyLayout["inherited"][string]) => {
    const items = itemsAt(slotKey(zone, null));
    return (
      <>
        <div className="flex min-h-[34px] flex-wrap content-start items-center gap-1.5 rounded-[2px] border border-zinc-800 bg-zinc-950/40 px-1.5 py-1">
          {items.map((f, i) => pill(f, i + 1))}
          {items.length === 0 && <span className="text-[11px] text-zinc-600">Aún no ha llegado ningún vuelo.</span>}
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">
          <span className="kicker mr-1.5 rounded-[2px] border border-zinc-700 px-1 py-[1px] text-[9px] text-zinc-400">No editable</span>
          Heredada de {from.agency} · {from.name}: el orden lo decide el controlador anterior.
        </p>
      </>
    );
  };

  return (
    <div ref={root} className="border-b border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
      {/* Una zona debajo de otra, cada una a todo el ancho de la agencia. */}
      <div className="flex flex-col gap-2">
        {layout.slots[slotKey(POOL_ZONE, null)] && (
          <Box kind="Sin ubicar" name="Esta agencia no tiene entrada" tone="border-l-zinc-600 text-zinc-400">
            {drop(POOL_ZONE, null)}
          </Box>
        )}
        {zones.map((z) => (
          <Box key={z.id} kind={KIND_LABEL[z.tipo]} name={z.nombre || z.id} tone={KIND_TONE[z.tipo]}>
            {z.tipo === "entrada" &&
              (layout.inherited[z.id] ? inheritedList(z.id, layout.inherited[z.id]) : drop(z.id, null, { minH: "min-h-[34px]" }))}

            {z.tipo === "salida" && (
              <>
                {drop(z.id, null, { numbered: true, minH: "min-h-[34px]" })}
                {z.destino && <p className="mt-1 text-[11px] text-zinc-500">→ {z.destino}</p>}
              </>
            )}

            {z.tipo === "stack" && <StackGrid zone={z} drop={drop} />}

            {/* Como una salida: los vuelos se numeran por orden de llegada. */}
            {z.tipo === "secuencia" && drop(z.id, null, { numbered: true, minH: "min-h-[34px]" })}
          </Box>
        ))}
      </div>
      {selected && (
        <p className="mt-1.5 text-[11px] text-gold">
          Toca la zona de destino para mover la pastilla, o tócala otra vez para soltarla.
        </p>
      )}

      {/*
        Menú, ficha del plan y pastilla arrastrada se dibujan fuera de la tarjeta
        de la agencia: las agencias ajenas se atenúan, y aquí no debe notarse.
      */}
      {overlay(
        <>
          {menu && (
            <FlightMenu
              request={menu}
              agency={agency}
              flights={flights}
              layouts={layouts}
              allZones={allZones}
              agencyStates={agencyStates}
              current={current}
              onSplit={(f) => {
                setMenu(null);
                onSplit(f);
              }}
              onMerge={(from, into) => {
                setMenu(null);
                onMerge(from, into);
              }}
              onMoves={(moves) => {
                setMenu(null);
                onMoves(moves);
              }}
              onClose={() => setMenu(null)}
            />
          )}

          {hover &&
            !drag &&
            !menu &&
            (() => {
              const f = flights.find((x) => x.id === hover.id);
              return f ? (
                <FlightPlanCard flight={f} sessionVars={sessionVars} planOrder={planOrder} formatTime={formatTime} at={hover} />
              ) : null;
            })()}

          {/* La pastilla sigue al puntero mientras se arrastra. */}
          {drag &&
            (() => {
              const f = flights.find((x) => x.id === drag.id);
              if (!f) return null;
              const color = colorOf(f);
              return (
                <div
                  className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: drag.x, top: drag.y }}
                >
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] font-cond text-[14px] leading-none font-semibold text-zinc-50"
                    style={{ borderColor: color, background: color }}
                  >
                    {f.vars.corto || f.callsign}
                  </span>
                </div>
              );
            })()}
        </>,
      )}
    </div>
  );
});

const KIND_LABEL: Record<Zone["tipo"], string> = {
  entrada: "Entrada",
  stack: "Stack",
  secuencia: "Secuencia",
  salida: "Salida",
};

const KIND_TONE: Record<Zone["tipo"], string> = {
  entrada: "border-l-alt text-alt",
  stack: "border-l-gold text-gold",
  secuencia: "border-l-coord text-coord",
  salida: "border-l-zinc-500 text-zinc-300",
};

function Box({ kind, name, tone, children }: { kind: string; name: string; tone: string; children: React.ReactNode }) {
  return (
    <div className={`w-full rounded-[2px] border border-l-4 border-zinc-800 bg-zinc-900/60 px-2.5 py-2 ${tone}`}>
      <p className="kicker mb-1.5 text-[10px]">
        {kind} · <span className="text-zinc-300">{name}</span>
      </p>
      {children}
    </div>
  );
}

/**
 * Stack en dos dimensiones: una columna por punto (eje X) y una fila por
 * bloque (eje Y). Un bloque que comparten varios puntos es una sola fila; las
 * celdas desactivadas en la configuración quedan vacías.
 */
function StackGrid({ zone, drop }: { zone: Zone; drop: (zone: string, slot: string | null) => React.ReactNode }) {
  const puntos = zone.puntos ?? [];
  const bloques = zone.bloques ?? [];
  const off = new Set(zone.excluidos ?? []);
  if (puntos.length === 0 || bloques.length === 0) return <p className="text-[11px] text-zinc-500">Sin puntos o sin bloques.</p>;
  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-max gap-1"
        style={{ gridTemplateColumns: `auto repeat(${puntos.length}, minmax(110px, 1fr))` }}
      >
        <span />
        {puntos.map((p) => (
          <span key={p} className="kicker px-1 text-center text-[10px] text-zinc-300">
            {p}
          </span>
        ))}
        {bloques.map((b) => (
          <Row key={b}>
            <span className="kicker flex items-center pr-2 text-[11px] text-zinc-300">{b}</span>
            {puntos.map((p) => {
              const cell = stackCell(p, b);
              return off.has(cell) ? (
                <span key={cell} className="rounded-[2px] bg-zinc-900/40" />
              ) : (
                <div key={cell} className="flex" title={`${p} · ${b}`}>
                  {drop(zone.id, cell)}
                </div>
              );
            })}
          </Row>
        ))}
      </div>
    </div>
  );
}

/** Las celdas de una fila van directamente a la rejilla. */
function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
