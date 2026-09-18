"use client";

import { memo } from "react";
import { Rendered } from "@/lib/template";
import type { Flight, Mark, MarkStatus, Step, Vars } from "@/lib/types";

const EMPTY: Vars = {};

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export type SetStatus = (step: Step, flight: Flight | null, status: MarkStatus | null) => void;

export const StepRow = memo(function StepRow({
  rowKey,
  step,
  flight,
  mark,
  sessionVars,
  highlighted,
  onSet,
}: {
  rowKey: string;
  step: Step;
  flight: Flight | null;
  mark: Mark | undefined;
  sessionVars: Vars;
  highlighted: boolean;
  onSet: SetStatus;
}) {
  const status = mark?.status ?? null;
  const fv = flight?.vars ?? EMPTY;
  // Pulsar el botón que ya está activo devuelve la fila a pendiente.
  const toggle = (s: MarkStatus) => onSet(step, flight, status === s ? null : s);

  return (
    <div
      data-row={rowKey}
      className={`tint flex flex-wrap items-start gap-x-2 px-2 py-[7px] sm:flex-nowrap ${
        highlighted ? "bg-gold/20" : status === "ko" ? "bg-ko/10" : ""
      }`}
    >
      <div className="flex shrink-0">
        <MarkButton kind="ok" active={status === "ok"} onClick={() => toggle("ok")} />
        <MarkButton kind="ko" active={status === "ko"} onClick={() => toggle("ko")} />
      </div>

      <div className="flex min-w-0 items-baseline gap-2 pt-[3px] sm:w-[88px] sm:shrink-0 sm:flex-col sm:gap-0">
        <span className="font-cond text-[14px] leading-tight font-semibold text-zinc-100">
          {flight ? flight.callsign : "Todos"}
        </span>
        <span className="text-[12px] text-zinc-500">{step.eta}</span>
      </div>

      <div className="w-full min-w-0 pb-0.5 sm:w-auto sm:flex-1 sm:pt-[2px]">
        {step.pilotText && (
          <p className="text-[12px] text-pilot">
            <Rendered text={step.pilotText} flightVars={fv} sessionVars={sessionVars} />
          </p>
        )}
        <p
          className={`tint text-[15px] font-semibold ${
            status === "ok" ? "text-zinc-500" : step.initiator === "coord" ? "text-[#a9c1e6]" : "text-zinc-50"
          }`}
        >
          <Rendered text={step.atcText} flightVars={fv} sessionVars={sessionVars} />
        </p>
        {step.readbackText && (
          <p className="text-[12px] text-zinc-500">
            <Rendered text={step.readbackText} flightVars={fv} sessionVars={sessionVars} />
          </p>
        )}
      </div>

      {mark && (
        <div className="ml-[60px] shrink-0 pt-[3px] text-right text-[12px] leading-tight sm:ml-0 sm:w-[64px]">
          <span className={`kicker ${mark.status === "ok" ? "text-ok" : "text-ko"}`}>{mark.status}</span>{" "}
          <span className="text-zinc-500">{hhmm(mark.doneAt)}</span>
          {mark.doneBy !== step.controller && <div className="kicker text-gold">por {mark.doneBy}</div>}
        </div>
      )}
    </div>
  );
});

function MarkButton({ kind, active, onClick }: { kind: MarkStatus; active: boolean; onClick: () => void }) {
  const ok = kind === "ok";
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ok ? "Correcta" : "Con error"}
      onClick={onClick}
      className="hit flex h-[30px] w-[30px] items-center justify-center"
    >
      <span
        className={`tint flex h-[22px] w-[22px] items-center justify-center rounded-[2px] border text-[13px] leading-none font-bold ${
          active
            ? ok
              ? "border-ok bg-ok text-zinc-950"
              : "border-ko bg-ko text-zinc-950"
            : ok
              ? "border-zinc-600 text-zinc-600 hover:border-ok hover:text-ok"
              : "border-zinc-600 text-zinc-600 hover:border-ko hover:text-ko"
        }`}
      >
        {ok ? "✓" : "✕"}
      </span>
    </button>
  );
}
