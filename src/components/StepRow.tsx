"use client";

import { memo } from "react";
import { Rendered } from "@/lib/template";
import type { Flight, Mark, Step, Vars } from "@/lib/types";

const EMPTY: Vars = {};

function hhmm(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export const StepRow = memo(function StepRow({
  rowKey,
  step,
  flight,
  mark,
  sessionVars,
  onToggle,
}: {
  rowKey: string;
  step: Step;
  flight: Flight | null;
  mark: Mark | undefined;
  sessionVars: Vars;
  onToggle: (step: Step, flight: Flight | null, done: boolean) => void;
}) {
  const done = !!mark;
  const fv = flight?.vars ?? EMPTY;
  const coord = step.initiator === "coord";

  return (
    <div
      data-row={rowKey}
      id={`row-${rowKey}`}
      className={`flex gap-3 px-3 py-3 transition-opacity duration-300 sm:gap-4 sm:px-4 ${
        done ? "opacity-40" : ""
      } ${coord ? "border-l-4 border-sky-500 bg-sky-950/30" : ""}`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? "Desmarcar" : "Marcar como hecha"}
        onClick={() => onToggle(step, flight, !done)}
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 text-3xl font-bold ${
          done
            ? "border-emerald-400 bg-emerald-500 text-zinc-950"
            : "border-zinc-500 bg-zinc-900 text-transparent active:bg-zinc-700"
        }`}
      >
        ✓
      </button>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-base font-bold text-zinc-100">{flight ? flight.callsign : "Todas las estaciones"}</span>
          <span className="font-mono text-sm text-zinc-400">{step.eta}</span>
          {coord && (
            <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-sky-300">
              Coordinación
            </span>
          )}
          {done && (
            <span className="text-sm text-zinc-300">
              ✓ {mark.doneBy} · <span className="font-mono">{hhmm(mark.doneAt)}</span>
            </span>
          )}
        </div>

        {step.pilotText && (
          <p className="mb-1.5 text-sm leading-snug text-red-400/70">
            <span className="mr-1 text-xs font-semibold uppercase">Piloto:</span>
            <Rendered text={step.pilotText} flightVars={fv} sessionVars={sessionVars} />
          </p>
        )}

        <p
          className={`text-xl leading-snug font-medium sm:text-2xl ${coord ? "text-sky-200" : "text-emerald-300"}`}
        >
          <Rendered text={step.atcText} flightVars={fv} sessionVars={sessionVars} />
        </p>

        {step.readbackText && (
          <p className="mt-1.5 text-sm leading-snug text-zinc-500">
            <span className="mr-1 text-xs font-semibold uppercase">Colación:</span>
            <Rendered text={step.readbackText} flightVars={fv} sessionVars={sessionVars} />
          </p>
        )}
      </div>
    </div>
  );
});
