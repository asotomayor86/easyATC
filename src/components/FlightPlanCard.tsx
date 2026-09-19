"use client";

import { Fragment } from "react";
import type { Flight, Vars } from "@/lib/types";

/**
 * Ficha con el plan de vuelo de un vuelo: las variables numeradas en
 * Variables → Plan, en ese orden, con su valor (el del vuelo o, si no lo
 * tiene, el global). Flota sobre la página junto al punto indicado.
 */
export function FlightPlanCard({
  flight,
  sessionVars,
  planOrder,
  formatTime,
  at,
}: {
  flight: Flight;
  sessionVars: Vars;
  planOrder: Record<string, number> | undefined;
  formatTime: (iso: string) => string;
  /** Rectángulo de la pastilla: la ficha se coloca debajo, sin salirse de la pantalla. */
  at: { left: number; bottom: number };
}) {
  const keys = Object.entries(planOrder ?? {})
    .sort((a, b) => a[1] - b[1])
    .map(([k]) => k);
  const value = (k: string) => flight.vars[k] || sessionVars[k] || "";
  const width = 320;
  const left = Math.max(8, Math.min(at.left, (typeof window === "undefined" ? 1200 : window.innerWidth) - width - 8));
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 rounded-[2px] border border-zinc-700 border-l-4 border-l-gold bg-zinc-900 px-3 py-2 shadow-none"
      style={{ left, top: at.bottom + 6, width }}
    >
      <p className="kicker mb-1.5 text-[10px] text-gold">Plan de vuelo · {flight.callsign}</p>
      {keys.length === 0 ? (
        <p className="text-[12px] text-zinc-500">Ninguna variable seleccionada. Numéralas en Variables → Plan.</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[13px]">
          {keys.map((k) => (
            <Fragment key={k}>
              <dt className="kicker pt-[2px] text-[10px] text-zinc-500">{k.replace(/_/g, " ")}</dt>
              <dd className={value(k) ? "text-zinc-100" : "text-zinc-600"}>{value(k) || "—"}</dd>
            </Fragment>
          ))}
        </dl>
      )}
      {flight.mergedFrom && flight.mergedAt && (
        <p className="mt-1.5 border-t border-zinc-800 pt-1.5 text-[12px] text-zinc-500">
          Absorbió a {flight.mergedFrom} a las {formatTime(flight.mergedAt)}
        </p>
      )}
    </div>
  );
}
