"use client";

import { useEffect, useRef, useState } from "react";
import type { Flight } from "@/lib/types";

/** «Dardo 1-1» → «Dardo 1-2», y si ya existe, el siguiente libre. */
export function suggestedName(flight: Flight, flights: Flight[]) {
  const taken = new Set(flights.map((f) => f.callsign.toLowerCase()));
  const m = flight.callsign.match(/^(.*?)(\d+)\s*$/);
  const base = m ? m[1] : `${flight.callsign} `;
  let n = m ? Number(m[2]) + 1 : 2;
  while (taken.has(`${base}${n}`.toLowerCase()) && n < 99) n++;
  return `${base}${n}`;
}

/** Diálogo de «Dividir vuelo»: pide el indicativo del vuelo nuevo. */
export function SplitDialog({
  flight,
  flights,
  agencyName,
  onCancel,
  onSplit,
}: {
  flight: Flight;
  flights: Flight[];
  agencyName: string;
  onCancel: () => void;
  onSplit: (nombre: string) => void;
}) {
  const [nombre, setNombre] = useState(() => suggestedName(flight, flights));
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.select();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onCancel]);

  const clean = nombre.trim();
  const duplicate = flights.some((f) => f.callsign.toLowerCase() === clean.toLowerCase());
  const error = !clean ? "Escribe un indicativo." : duplicate ? `Ya hay un vuelo llamado «${clean}».` : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onCancel} role="presentation">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="split-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!error) onSplit(clean);
        }}
        className="w-full max-w-md rounded-[2px] border border-zinc-700 border-l-4 border-l-gold bg-zinc-900 p-4"
      >
        <p className="kicker mb-2 text-gold">Dividir vuelo</p>
        <p id="split-title" className="mb-3 text-[14px] text-zinc-100">
          Se desprende un vuelo nuevo de <strong>{flight.callsign}</strong>, que nace en la entrada de {agencyName}.
        </p>
        <label className="mb-3 block">
          <span className="kicker mb-1 block text-[10px] text-zinc-400">Indicativo del vuelo nuevo</span>
          <input
            ref={input}
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={40}
            className={`w-full rounded-[2px] border bg-zinc-950 px-2.5 py-2 text-[15px] outline-none ${
              error ? "border-ko" : "border-zinc-700 focus:border-gold"
            }`}
          />
          {error && <span className="mt-1 block text-[12px] text-ko">{error}</span>}
        </label>
        <p className="mb-4 rounded-[2px] border border-missing/40 bg-missing/10 px-3 py-2 text-[13px] text-missing">
          El vuelo nuevo <strong>no tiene plan de vuelo</strong>. Todas sus variables quedan sin asignar y habrá que
          colocarlo en los tableros desde cero.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="kicker rounded-[2px] border border-zinc-600 px-3 py-2 text-[12px] text-zinc-300 hover:border-zinc-400"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!!error}
            className="kicker rounded-[2px] border border-gold bg-gold px-3 py-2 text-[12px] text-zinc-950 disabled:opacity-40"
          >
            Dividir
          </button>
        </div>
      </form>
    </div>
  );
}
