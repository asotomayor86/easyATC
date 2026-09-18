"use client";

import { AGENCY_LIST, agencyChannel, agencyName } from "@/lib/guion";
import type { AgencyStateName, Role, Vars } from "@/lib/types";

export function AgencyChips({
  states,
  role,
  current,
  sessionVars,
  onPress,
}: {
  states: Map<string, AgencyStateName>;
  role: Role;
  current?: string;
  sessionVars: Vars;
  onPress: (agency: string) => void;
}) {
  return (
    <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 min-[1100px]:mx-0 min-[1100px]:grid min-[1100px]:grid-cols-9 min-[1100px]:overflow-visible min-[1100px]:px-0">
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
              state === "abierta"
                ? "border-gold bg-zinc-900"
                : state === "finalizada"
                  ? "border-zinc-800 bg-zinc-950 opacity-60"
                  : "border-zinc-800 bg-zinc-950"
            }`}
          >
            <StateMark state={state} />
            {/* La agencia que está en el centro de la pantalla */}
            {current === a.id && <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-gold" />}
            <span className="min-w-0">
              <span
                className={`tint block font-cond text-[15px] leading-none font-bold tracking-wide ${
                  state === "abierta" ? "text-zinc-50" : "text-zinc-500"
                }`}
              >
                {a.id}
              </span>
              <span className="kicker mt-0.5 block text-[10px] text-zinc-500">
                CH {agencyChannel(a.id, sessionVars)} ·{" "}
                <span className={mine ? "text-gold" : ""}>{a.controlador}</span>
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
