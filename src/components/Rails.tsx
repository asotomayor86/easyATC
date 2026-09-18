"use client";

import { memo } from "react";
import { groupBySteps, type AgencyGroup } from "@/lib/progress";
import type { Mark, Role } from "@/lib/types";

/**
 * Un riel por agencia, un punto por transmisión. Los pasos «vuelo» son cuatro
 * puntos juntos; los «todos», uno algo mayor. Las alternativas, anillo sin relleno.
 */
export const Rails = memo(function Rails({
  groups,
  marks,
  role,
  onJump,
}: {
  groups: AgencyGroup[];
  marks: Map<string, Mark>;
  role: Role;
  onJump: (rowKey: string) => void;
}) {
  return (
    <div className="space-y-[3px]">
      {groups.map((g) => (
        <div key={g.agency} className="flex items-center gap-2">
          <span
            className={`kicker w-[64px] shrink-0 text-[10px] ${g.controller === role ? "text-gold" : "text-zinc-500"}`}
          >
            {g.agency} <span className="text-zinc-600">{g.controller}</span>
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-[5px] overflow-x-auto py-[1px]">
            {groupBySteps(g.rows).map(({ step, rows }) => (
              <span key={step.id} className="flex shrink-0 items-center gap-[2px]">
                {rows.map((r) => (
                  <Dot
                    key={r.key}
                    status={marks.get(r.key)?.status ?? null}
                    alt={step.alt}
                    big={!r.flight}
                    label={`${step.agency} ${step.eta} ${r.flight?.callsign ?? "Todos"}`}
                    onClick={() => onJump(r.key)}
                  />
                ))}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});

function Dot({
  status,
  alt,
  big,
  label,
  onClick,
}: {
  status: "ok" | "ko" | null;
  alt: boolean;
  big: boolean;
  label: string;
  onClick: () => void;
}) {
  const size = big ? "h-[10px] w-[10px]" : "h-[7px] w-[7px]";
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
      className={`tint shrink-0 rounded-full border ${alt ? "border-[1.5px]" : ""} ${size} ${color}`}
    />
  );
}
