"use client";

import { memo } from "react";
import { rowKey } from "@/lib/progress";
import type { Flight, Mark, Role, Step } from "@/lib/types";

/**
 * Un riel por vuelo: sus transmisiones en orden, separadas por agencia. Los
 * pasos «todos» aparecen en los cuatro rieles. Las alternativas, anillo sin
 * relleno. Todos los rieles tienen la misma estructura, así que las
 * agencias quedan alineadas en columnas.
 */
export const Rails = memo(function Rails({
  steps,
  flights,
  marks,
  role,
  onJump,
}: {
  steps: Step[];
  flights: Flight[];
  marks: Map<string, Mark>;
  role: Role;
  onJump: (rowKey: string) => void;
}) {
  const segments: { agency: string; controller: Role; steps: Step[] }[] = [];
  for (const s of steps) {
    const last = segments[segments.length - 1];
    if (last && last.agency === s.agency) last.steps.push(s);
    else segments.push({ agency: s.agency, controller: s.controller, steps: [s] });
  }
  const keyFor = (s: Step, f: Flight) => rowKey(s.id, s.scope === "vuelo" ? f.id : null);

  return (
    <div className="flex items-start gap-2">
      {/* Indicativos */}
      <div className="w-[64px] shrink-0">
        <div className="h-[14px]" />
        {flights.map((f) => (
          <div key={f.id} className="flex h-[14px] items-center font-cond text-[12px] font-semibold text-zinc-300">
            {f.vars.corto || f.callsign}
          </div>
        ))}
      </div>

      {/* Puntos: una columna por agencia */}
      <div className="min-w-0 flex-1 overflow-x-auto">
        <div className="flex w-max gap-[10px]">
          {segments.map((seg) => (
            <div key={seg.agency} className="shrink-0">
              <div
                className={`kicker flex h-[14px] items-center text-[10px] ${
                  seg.controller === role ? "text-gold" : "text-zinc-500"
                }`}
              >
                {seg.agency}
              </div>
              {flights.map((f) => (
                <div key={f.id} className="flex h-[14px] items-center gap-[3px]">
                  {seg.steps.map((s) => {
                    const k = keyFor(s, f);
                    return (
                      <Dot
                        key={s.id}
                        status={marks.get(k)?.status ?? null}
                        alt={s.alt}
                        label={`${f.callsign} · ${s.agency} ${s.eta}${s.scope !== "vuelo" ? " (todos)" : ""}`}
                        onClick={() => onJump(k)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Progreso de cada vuelo */}
      <div className="shrink-0 text-right">
        <div className="h-[14px]" />
        {flights.map((f) => {
          let done = 0;
          let total = 0;
          let ko = 0;
          for (const s of steps) {
            const m = marks.get(keyFor(s, f));
            if (m?.status === "ko") ko++;
            if (s.alt) continue;
            total++;
            if (m) done++;
          }
          return (
            <div key={f.id} className="kicker flex h-[14px] items-center justify-end gap-1.5 text-[10px] text-zinc-500">
              <span className="text-zinc-300">
                {done}/{total}
              </span>
              <span className={ko ? "text-ko" : "text-zinc-700"}>{ko} KO</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

function Dot({
  status,
  alt,
  label,
  onClick,
}: {
  status: "ok" | "ko" | null;
  alt: boolean;
  label: string;
  onClick: () => void;
}) {
  const color =
    status === "ok"
      ? alt
        ? "border-ok"
        : "border-ok bg-ok"
      : status === "ko"
        ? alt
          ? "border-ko"
          : "border-ko bg-ko"
        : alt
          ? "border-zinc-500"
          : "border-zinc-700 bg-zinc-700";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`tint shrink-0 rounded-full border ${alt ? "border-[1.5px]" : ""} h-[8px] w-[8px] ${color}`}
    />
  );
}
