"use client";

import { useParams } from "next/navigation";
import { BlurInput } from "@/components/BlurInput";
import { Nav } from "@/components/Nav";
import { api, useSessionData } from "@/lib/client";
import { agencyName } from "@/lib/guion";
import type { Step } from "@/lib/types";

export default function GuionPage() {
  const code = String(useParams<{ code: string }>().code).toUpperCase();
  const { data, error } = useSessionData(code);

  if (error) return <p className="p-6 text-ko">{error}</p>;
  if (!data) return <p className="p-6 text-zinc-500">Cargando…</p>;

  const phases = new Map<number, Step[]>();
  for (const s of data.steps) {
    if (!phases.has(s.phase)) phases.set(s.phase, []);
    phases.get(s.phase)!.push(s);
  }

  const save = (id: string, field: "pilotText" | "atcText" | "readbackText") => async (v: string) => {
    await api(`/api/s/${code}/steps/${id}`, "PATCH", { [field]: v });
  };

  return (
    <main className="mx-auto max-w-[70rem] px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="kicker text-gold">{data.session.code}</p>
          <h1 className="font-cond text-[30px] leading-tight font-extrabold uppercase">Guion · {data.steps.length} pasos</h1>
        </div>
        <Nav code={code} current="guion" />
      </header>

      <p className="mb-8 rounded-[2px] border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-400">
        Cada texto es una plantilla común a todos los vuelos. Usa <code className="text-missing">{"{variable}"}</code>{" "}
        para los datos y <code className="text-zinc-300">[hueco]</code> para lo que se dice de viva voz. Se guarda al salir
        del campo.
      </p>

      {[...phases.entries()].map(([phase, steps]) => (
        <section key={phase} className="mb-10">
          <h2 className="sticky top-0 z-10 -mx-4 mb-3 border-b border-zinc-800 bg-zinc-950 px-4 py-2 font-cond text-[20px] font-bold uppercase tracking-wide">
            Fase {phase} · <span className="text-zinc-400">{agencyName(steps[0].agency)}</span>
          </h2>
          <ol className="space-y-4">
            {steps.map((s) => (
              <li key={s.id} className="rounded-[2px] border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono text-zinc-500">#{s.idx}</span>
                  <Tag>{s.agency}</Tag>
                  <Tag>{s.controller}</Tag>
                  <Tag>{s.scope === "vuelo" ? "por vuelo" : "a todos"}</Tag>
                  <Tag>inicia: {s.initiator}</Tag>
                  <span className="text-zinc-500">{s.eta}</span>
                  {s.alt && <Tag tone="alt">alternativa</Tag>}
                  {s.note && <span className="text-zinc-400 italic">{s.note}</span>}
                </div>
                <div className="grid gap-3">
                  <Field label="Llamada del piloto" tone="text-pilot">
                    <BlurInput value={s.pilotText ?? ""} onSave={save(s.id, "pilotText")} multiline placeholder="(sin llamada)" />
                  </Field>
                  <Field label="Transmisión del controlador" tone="text-zinc-100">
                    <BlurInput
                      value={s.atcText}
                      onSave={save(s.id, "atcText")}
                      multiline
                      rows={3}
                      className="text-zinc-50"
                    />
                  </Field>
                  <Field label="Colación esperada" tone="text-zinc-400">
                    <BlurInput value={s.readbackText ?? ""} onSave={save(s.id, "readbackText")} multiline placeholder="(sin colación)" />
                  </Field>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </main>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: "alt" }) {
  return (
    <span
      className={`kicker rounded-[2px] px-1.5 py-0.5 text-[10px] ${
        tone === "alt" ? "border border-alt/70 text-alt" : "bg-zinc-800 text-zinc-300"
      }`}
    >
      {children}
    </span>
  );
}

function Field({ label, tone, children }: { label: string; tone: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={`kicker mb-1 block ${tone}`}>{label}</span>
      {children}
    </label>
  );
}
