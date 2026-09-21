"use client";

import { AGENCY_LIST, agencyChannel, agencyName } from "@/lib/guion";
import type { AgencyStateName, Seat, Vars } from "@/lib/types";

export function AgencyChips({
  states,
  role,
  current,
  flightsAt,
  sessionVars,
  onPress,
}: {
  states: Map<string, AgencyStateName>;
  role: Seat;
  current?: string;
  /** Vuelos que hay ahora en cada agencia: un punto de su color por vuelo. */
  flightsAt: Record<string, { id: string; name: string; color: string }[]>;
  sessionVars: Vars;
  onPress: (agency: string) => void;
}) {
  return (
    <div className="no-bar -mx-3 flex gap-1.5 overflow-x-auto px-3 min-[1100px]:mx-0 min-[1100px]:grid min-[1100px]:grid-cols-9 min-[1100px]:overflow-visible min-[1100px]:px-0">
      {AGENCY_LIST.map((a) => {
        const state = states.get(a.id) ?? "cerrada";
        const mine = a.controlador === role;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onPress(a.id)}
            title={`Ir a ${agencyName(a.id)} · ${state}`}
            aria-current={current === a.id ? "true" : undefined}
            className={`tint relative flex min-w-[84px] shrink-0 items-center gap-2 rounded-[2px] border px-2 py-1 text-left ${
              // Las agencias propias llevan fondo dorado tenue en cualquier estado.
              mine ? "bg-gold/20" : state === "abierta" ? "bg-zinc-900" : "bg-zinc-950"
            } ${
              state === "abierta" ? "border-gold" : mine ? "border-gold/35" : "border-zinc-800"
            } ${state === "finalizada" ? "opacity-60" : ""}`}
          >
            <StateMark state={state} />
            {/* La agencia que está en el centro de la pantalla */}
            {current === a.id && <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-gold" />}
            <span className="min-w-0">
              <span
                className={`tint block font-cond text-[15px] leading-none font-bold tracking-wide ${
                  state === "abierta" || mine ? "text-zinc-50" : "text-zinc-500"
                }`}
              >
                {a.id}
              </span>
              <span className={`kicker mt-0.5 block text-[10px] ${mine ? "text-zinc-300" : "text-zinc-500"}`}>
                CH {agencyChannel(a.id, sessionVars)} ·{" "}
                <span className={mine ? "text-gold" : ""}>{a.controlador}</span>
              </span>
              {/* Dónde está cada vuelo, de un vistazo. */}
              <span className="mt-1 flex min-h-2 flex-wrap items-center gap-1">
                {(flightsAt[a.id] ?? []).map((f) => (
                  <span
                    key={f.id}
                    title={f.name}
                    className="tint h-2 w-2 shrink-0 rounded-full"
                    style={{ background: f.color }}
                  />
                ))}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function StateMark({ state }: { state: AgencyStateName }) {
  if (state === "finalizada")
    return <span className="w-2.5 shrink-0 text-center text-[12px] leading-none font-bold text-ok/70">✓</span>;
  return (
    <span
      className={`tint h-2.5 w-2.5 shrink-0 rounded-full border ${
        state === "abierta" ? "border-ok bg-ok" : "border-zinc-600 bg-transparent"
      }`}
    />
  );
}
