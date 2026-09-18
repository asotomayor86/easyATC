"use client";

import { useRef, useState } from "react";
import { ConfirmDialog, type ConfirmRequest } from "@/components/ConfirmDialog";
import { api } from "@/lib/client";
import { parseMissionFile, toMissionFile } from "@/lib/missionFile";
import type { SessionData } from "@/lib/types";

/** Exportar e importar la misión completa (variables, vuelos y guion) como JSON. */
export function MissionFileButtons({ data, onImported }: { data: SessionData; onImported: () => void }) {
  const code = data.session.code;
  const input = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function exportFile() {
    const file = toMissionFile(data.session, data.flights, data.steps);
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mision-${code}-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMessage({ ok: true, text: `Exportado: ${data.steps.length} pasos, ${data.flights.length} vuelos.` });
  }

  async function pickFile(file: File) {
    setMessage(null);
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      setMessage({ ok: false, text: `${file.name} no es un JSON válido.` });
      return;
    }
    const parsed = parseMissionFile(json);
    if (!parsed.ok) {
      setMessage({ ok: false, text: `${file.name}: ${parsed.error}` });
      return;
    }
    const { flights, steps } = parsed.mission;
    setConfirm({
      message: `Importar ${file.name} (${steps.length} pasos, ${flights.length} vuelos) sustituye las variables, los vuelos y el guion de ${code}, y borra sus marcas, el estado de las agencias y la hora de inicio. ¿Continuar?`,
      confirmLabel: "Importar",
      onConfirm: async () => {
        try {
          await api(`/api/s/${code}/import`, "POST", json);
          setMessage({ ok: true, text: `Importado ${file.name}: ${steps.length} pasos, ${flights.length} vuelos.` });
          onImported();
        } catch {
          setMessage({ ok: false, text: "No se pudo importar: el servidor rechazó el archivo o no hay conexión." });
        }
      },
    });
  }

  const button =
    "kicker rounded-[2px] border border-zinc-600 px-2.5 py-1.5 text-[11px] text-zinc-300 hover:border-gold hover:text-gold";
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1.5">
        <button type="button" onClick={exportFile} className={button}>
          ↓ Exportar JSON
        </button>
        <button type="button" onClick={() => input.current?.click()} className={button}>
          ↑ Importar JSON
        </button>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = ""; // permite volver a elegir el mismo archivo
            if (f) pickFile(f);
          }}
        />
      </div>
      {message && <p className={`text-[12px] ${message.ok ? "text-ok" : "text-ko"}`}>{message.text}</p>}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
