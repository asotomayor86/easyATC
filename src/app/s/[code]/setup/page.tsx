"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { BlurInput } from "@/components/BlurInput";
import { MissionFileButtons } from "@/components/MissionFileButtons";
import { Nav } from "@/components/Nav";
import { api, useSessionData } from "@/lib/client";
import type { Flight } from "@/lib/types";

export default function SetupPage() {
  const code = String(useParams<{ code: string }>().code).toUpperCase();
  const { data, error, reload } = useSessionData(code);
  const [newSessionVar, setNewSessionVar] = useState("");
  const [newFlightVar, setNewFlightVar] = useState("");
  // Tras importar, se vuelven a montar los campos para que muestren lo nuevo.
  const [version, setVersion] = useState(0);

  if (error) return <p className="p-6 text-ko">{error}</p>;
  if (!data) return <p className="p-6 text-zinc-500">Cargando…</p>;

  const { session, flights } = data;
  const flightKeys = unionKeys(flights);

  const saveSession = (k: string) => async (v: string) => {
    await api(`/api/s/${code}`, "PATCH", { vars: { [k]: v } });
  };
  const saveFlight = (id: string, k: string) => async (v: string) => {
    await api(`/api/s/${code}/flights/${id}`, "PATCH", { vars: { [k]: v } });
  };

  async function addSessionVar(e: React.FormEvent) {
    e.preventDefault();
    const k = normKey(newSessionVar);
    if (!k || k in session.vars) return;
    await api(`/api/s/${code}`, "PATCH", { vars: { [k]: "" } });
    setNewSessionVar("");
    reload();
  }

  async function addFlightVar(e: React.FormEvent) {
    e.preventDefault();
    const k = normKey(newFlightVar);
    if (!k || flightKeys.includes(k)) return;
    await Promise.all(flights.map((f) => api(`/api/s/${code}/flights/${f.id}`, "PATCH", { vars: { [k]: "" } })));
    setNewFlightVar("");
    reload();
  }

  return (
    <main className="mx-auto max-w-[70rem] px-4 py-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="kicker text-gold">{session.code}</p>
          <h1 className="font-cond text-[30px] leading-tight font-extrabold uppercase">{session.name}</h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Nav code={code} current="setup" />
          <MissionFileButtons
            data={data}
            onImported={async () => {
              await reload();
              setVersion((v) => v + 1);
            }}
          />
        </div>
      </header>

      <p className="mb-8 rounded-[2px] border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-400">
        Los cambios se guardan al salir de cada campo. Para retocar los textos de las transmisiones, ve al{" "}
        <Link href={`/s/${code}/guion`} className="font-semibold text-gold underline">
          guion
        </Link>
        .
      </p>

      <div key={version}>
      <section className="mb-12">
        <h2 className="mb-4 kicker text-gold">Variables globales</h2>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.keys(session.vars).map((k) => (
            <label key={k} className="block">
              <span className="mb-1 block font-mono text-xs text-zinc-500">{`{${k}}`}</span>
              <BlurInput value={session.vars[k] ?? ""} onSave={saveSession(k)} />
            </label>
          ))}
        </div>
        <AddVar value={newSessionVar} onChange={setNewSessionVar} onSubmit={addSessionVar} />
      </section>

      <section>
        <h2 className="mb-4 kicker text-gold">Vuelos</h2>
        <div className="overflow-x-auto rounded-[2px] border border-zinc-800">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-900">
                <th className="sticky left-0 z-10 bg-zinc-900 px-3 py-2 text-left font-medium text-zinc-500">
                  Variable
                </th>
                {flights.map((f) => (
                  <th key={f.id} className="px-2 py-2 text-left font-semibold text-zinc-200">
                    {f.callsign}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flightKeys.map((k) => (
                <tr key={k} className="border-t border-zinc-800">
                  <td className="sticky left-0 z-10 bg-zinc-950 px-3 py-1.5 font-mono text-xs text-zinc-500">
                    {`{${k}}`}
                  </td>
                  {flights.map((f) => (
                    <td key={f.id} className="px-1.5 py-1 align-top">
                      <BlurInput
                        value={f.vars[k] ?? ""}
                        onSave={saveFlight(f.id, k)}
                        multiline={(f.vars[k] ?? "").length > 40}
                        rows={3}
                        className="text-sm"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AddVar value={newFlightVar} onChange={setNewFlightVar} onSubmit={addFlightVar} />
      </section>
      </div>
    </main>
  );
}

function unionKeys(flights: Flight[]): string[] {
  const keys: string[] = [];
  for (const f of flights) for (const k of Object.keys(f.vars)) if (!keys.includes(k)) keys.push(k);
  return keys;
}

function normKey(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[{}]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .slice(0, 40);
}

function AddVar({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="mt-4 flex max-w-sm gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="nueva_variable"
        className="flex-1 rounded-[2px] border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 font-mono text-sm outline-none focus:border-gold"
      />
      <button className="rounded-[2px] border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800">
        Añadir
      </button>
    </form>
  );
}
