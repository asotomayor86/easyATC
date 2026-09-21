"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { BlurInput } from "@/components/BlurInput";
import { ConfirmDialog, type ConfirmRequest } from "@/components/ConfirmDialog";
import { MissionFileButtons } from "@/components/MissionFileButtons";
import { Nav } from "@/components/Nav";
import { api, useSessionData } from "@/lib/client";
import { agencyName } from "@/lib/guion";
import type { Step } from "@/lib/types";

export default function GuionPage() {
  const code = String(useParams<{ code: string }>().code).toUpperCase();
  const { data, error, reload } = useSessionData(code);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [busy, setBusy] = useState(false);
  // Tras importar, se vuelven a montar los campos para que muestren lo nuevo.
  const [version, setVersion] = useState(0);

  if (error) return <p className="p-6 text-ko">{error}</p>;
  if (!data) return <p className="p-6 text-zinc-500">Cargando…</p>;

  const phases = new Map<number, Step[]>();
  for (const s of data.steps) {
    if (!phases.has(s.phase)) phases.set(s.phase, []);
    phases.get(s.phase)!.push(s);
  }

  const save = (id: string, field: "pilotText" | "atcText" | "readbackText" | "checklist") => async (v: string) => {
    await api(`/api/s/${code}/steps/${id}`, "PATCH", { [field]: v });
  };

  async function addAfter(s: Step) {
    setBusy(true);
    try {
      const created = await api<Step>(`/api/s/${code}/steps`, "POST", { afterId: s.id });
      await reload();
      // Lleva a la nueva y deja el cursor en la transmisión del controlador.
      requestAnimationFrame(() => {
        const el = document.getElementById(`step-${created.id}`);
        el?.scrollIntoView({ block: "center" });
        el?.querySelectorAll("textarea")[1]?.focus();
      });
    } finally {
      setBusy(false);
    }
  }

  function remove(s: Step) {
    setConfirm({
      message: `¿Quitar la comunicación #${s.idx} (${s.agency} ${s.eta})? Se borran también sus marcas.`,
      confirmLabel: "Quitar",
      onConfirm: async () => {
        await api(`/api/s/${code}/steps/${s.id}`, "DELETE");
        reload();
      },
    });
  }

  return (
    <main className="mx-auto max-w-[70rem] px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="kicker text-gold">{data.session.code}</p>
          <h1 className="font-cond text-[30px] leading-tight font-extrabold uppercase">Guion · {data.steps.length} pasos</h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Nav code={code} current="guion" />
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
        Cada texto es una plantilla común a todos los vuelos. Usa <code className="text-missing">{"{variable}"}</code>{" "}
        para los datos y <code className="text-zinc-300">[hueco]</code> para lo que se dice de viva voz. Se guarda al salir
        del campo.
      </p>

      <div key={version}>
      {[...phases.entries()].map(([phase, steps]) => (
        <section key={phase} className="mb-10">
          <h2 className="sticky top-0 z-10 -mx-4 mb-3 border-b border-zinc-800 bg-zinc-950 px-4 py-2 font-cond text-[20px] font-bold uppercase tracking-wide">
            Fase {phase} · <span className="text-zinc-400">{agencyName(steps[0].agency)}</span>
          </h2>
          <ol className="space-y-4">
            {steps.map((s) => (
              <li key={s.id} id={`step-${s.id}`} className="rounded-[2px] border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono text-zinc-500">#{s.idx}</span>
                  <Tag>{s.agency}</Tag>
                  <Tag>{s.controller}</Tag>
                  <Tag>{s.scope === "vuelo" ? "por vuelo" : "a todos"}</Tag>
                  <Tag>inicia: {s.initiator}</Tag>
                  <span className="text-zinc-500">{s.eta}</span>
                  <BoolToggle code={code} step={s} field="alt" label="Alternativa" tone="text-alt" />
                  <BoolToggle code={code} step={s} field="counts" label="Cuenta para rieles y estadísticas" />
                  {s.note && <span className="text-zinc-400 italic">{s.note}</span>}
                  <span className="ml-auto flex gap-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => addAfter(s)}
                      className="kicker rounded-[2px] border border-zinc-600 px-2 py-1 text-[10px] text-zinc-300 hover:border-gold hover:text-gold disabled:opacity-40"
                    >
                      + Añadir debajo
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => remove(s)}
                      className="kicker rounded-[2px] border border-ko/40 px-2 py-1 text-[10px] text-ko hover:border-ko disabled:opacity-40"
                    >
                      Quitar
                    </button>
                  </span>
                </div>
                <div className="grid gap-3">
                  <Field label="Checklist (nombre resumen)" tone="text-gold">
                    <BlurInput value={s.checklist} onSave={save(s.id, "checklist")} placeholder="(sin nombre de checklist)" />
                  </Field>
                  <Field label="Llamada del piloto" tone="text-pilot">
                    <BlurInput value={s.pilotText ?? ""} onSave={save(s.id, "pilotText")} multiline placeholder="(sin llamada)" />
                  </Field>
                  <Field label="Transmisión del controlador" tone="text-zinc-100">
                    <BlurInput
                      value={s.atcText}
                      placeholder="(escribe la transmisión)"
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
      </div>
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </main>
  );
}

/** Casilla de sí o no de una comunicación («alternativa», «cuenta»): se guarda al pulsarla. */
function BoolToggle({
  code,
  step,
  field,
  label,
  tone = "text-zinc-300",
}: {
  code: string;
  step: Step;
  field: "counts" | "alt";
  label: string;
  /** Color de la etiqueta cuando está marcada. */
  tone?: string;
}) {
  const [on, setOn] = useState(step[field]);
  const [failed, setFailed] = useState(false);
  return (
    <label className={`kicker flex cursor-pointer items-center gap-1.5 text-[10px] ${on ? tone : "text-zinc-500"}`}>
      <input
        type="checkbox"
        checked={on}
        onChange={async (e) => {
          const v = e.target.checked;
          setOn(v);
          setFailed(false);
          try {
            await api(`/api/s/${code}/steps/${step.id}`, "PATCH", { [field]: v });
          } catch {
            setOn(!v);
            setFailed(true);
          }
        }}
        className="h-3.5 w-3.5 accent-[var(--color-gold)]"
      />
      {label}
      {failed && <span className="text-ko">· no se guardó</span>}
    </label>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="kicker rounded-[2px] bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">{children}</span>;
}

function Field({ label, tone, children }: { label: string; tone: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={`kicker mb-1 block ${tone}`}>{label}</span>
      {children}
    </label>
  );
}
