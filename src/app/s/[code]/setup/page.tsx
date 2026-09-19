"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { cloneElement, useEffect, useRef, useState } from "react";
import { BlurInput } from "@/components/BlurInput";
import { ConfirmDialog, type ConfirmRequest } from "@/components/ConfirmDialog";
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
  const [local, setLocal] = useState<{ order: string[]; marked: string[] } | null>(null);
  const [planError, setPlanError] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  // El plan de vuelo solo lo forman las variables de la tabla. Si quedaba
  // alguna global marcada de antes, se quita una sola vez al abrir la página.
  const purged = useRef(false);
  useEffect(() => {
    if (!data || purged.current) return;
    const keys = unionKeys(data.flights);
    const old = data.session.planOrder ?? {};
    if (Object.keys(old).every((k) => keys.includes(k))) return;
    purged.current = true;
    const planOrder: Record<string, number> = {};
    for (const k of Object.keys(old).sort((a, b) => old[a] - old[b])) {
      if (keys.includes(k)) planOrder[k] = Object.keys(planOrder).length + 1;
    }
    api(`/api/s/${code}`, "PATCH", { planOrder }).then(() => reload()).catch(() => {});
  }, [data, code, reload]);

  if (error) return <p className="p-6 text-ko">{error}</p>;
  if (!data) return <p className="p-6 text-zinc-500">Cargando…</p>;

  const { session, flights } = data;

  // --- Orden de las variables y plan de vuelo impreso ---
  // El número del plan no se guarda a mano: es la posición, de arriba a abajo,
  // entre las variables marcadas, siguiendo el orden de esta página.
  // Cada variable se identifica con su sección delante («s:qnh», «f:cs»): la
  // misma clave puede estar en las globales y en las de vuelo.
  const varOrder = local?.order ?? session.varOrder ?? [];
  const byOrder = (prefix: "s" | "f", keys: string[]) => {
    const pos = (k: string) => {
      const i = varOrder.indexOf(`${prefix}:${k}`);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return [...keys].sort((a, b) => pos(a) - pos(b) || keys.indexOf(a) - keys.indexOf(b));
  };
  const globalKeys = byOrder("s", Object.keys(session.vars));
  const flightKeys = byOrder("f", unionKeys(flights));
  const marked = new Set(
    (local ? local.marked : Object.keys(session.planOrder ?? {})).filter((k) => flightKeys.includes(k)),
  );
  const numbers: Record<string, number> = {};
  for (const k of flightKeys) if (marked.has(k)) numbers[k] = Object.keys(numbers).length + 1;

  async function save(order: string[], markedKeys: Set<string>) {
    const planOrder: Record<string, number> = {};
    // Solo las de la tabla: son las que salen en el plan de vuelo impreso.
    for (const k of order) {
      if (k.startsWith("f:") && markedKeys.has(k.slice(2))) planOrder[k.slice(2)] = Object.keys(planOrder).length + 1;
    }
    setLocal({ order, marked: [...markedKeys] });
    setPlanError(false);
    try {
      await api(`/api/s/${code}`, "PATCH", { planOrder, varOrder: order });
    } catch {
      setPlanError(true);
    }
  }

  /** La lista completa, con la sección delante, tal y como se ve la página. */
  const full = (globales: string[], vuelos: string[]) => [
    ...globales.map((k) => `s:${k}`),
    ...vuelos.map((k) => `f:${k}`),
  ];

  const togglePlan = (k: string) => {
    const next = new Set(marked);
    if (!next.delete(k)) next.add(k);
    return save(full(globalKeys, flightKeys), next);
  };

  /** Reordena una de las dos listas y deja la otra como está. */
  const reorder = (section: "globales" | "vuelos") => (keys: string[]) =>
    save(section === "globales" ? full(keys, flightKeys) : full(globalKeys, keys), marked);

  /** Borra la variable de todos los vuelos, con sus valores. */
  const deleteVar = (k: string) =>
    setConfirm({
      title: "Borrar variable",
      message:
        `Se borrará {${k}} y su valor en los ${flights.length} vuelos. Si el guion la usa en algún texto, ` +
        "ese texto dejará de rellenarse. No se puede deshacer.",
      confirmLabel: "Borrar",
      onConfirm: async () => {
        setConfirm(null);
        await Promise.all(flights.map((f) => api(`/api/s/${code}/flights/${f.id}`, "PATCH", { remove: [k] })));
        const rest = flightKeys.filter((x) => x !== k);
        const next = new Set(marked);
        next.delete(k);
        await save(full(globalKeys, rest), next);
        reload();
      },
    });

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
              setLocal(null);
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
. Arrastra una variable por su asa <span className="text-zinc-300">⠿</span> para colocarla donde quieras. En la tabla{" "}
        <span className="kicker text-gold">Plan de vuelo</span>, marca con <span className="kicker text-gold">Plan</span>{" "}
        las que salen en el plan impreso: se numeran solas, de arriba a abajo, según el orden de la tabla.
        {planError && <span className="mt-1 block text-ko">No se pudo guardar el orden.</span>}
      </p>

      <div key={version}>
        <section className="mb-12">
          <h2 className="kicker mb-4 text-gold">Variables globales</h2>
          <DragList keys={globalKeys} onReorder={reorder("globales")}>
            {(k, drag) => (
              <div className={`rounded-[2px] px-1.5 py-1 ${drag.className}`}>
                <div className="mb-1 flex min-w-0 items-center gap-1.5">
                  <Handle {...drag.handle} />
                  <span className="truncate font-mono text-xs text-zinc-500">{`{${k}}`}</span>
                </div>
                <BlurInput value={session.vars[k] ?? ""} onSave={saveSession(k)} />
              </div>
            )}
          </DragList>
          <AddVar value={newSessionVar} onChange={setNewSessionVar} onSubmit={addSessionVar} />
        </section>

        <section>
          <h2 className="kicker mb-4 text-gold">Plan de vuelo</h2>
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
                  <th
                    className="kicker px-2 py-2 text-center text-[10px] text-gold"
                    title="Sale en el plan de vuelo impreso, con este número de orden"
                  >
                    Plan
                  </th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <DragList as="tbody" keys={flightKeys} onReorder={reorder("vuelos")}>
                {(k, drag) => (
                  <tr className={`border-t border-zinc-800 ${drag.className}`}>
                    <td className="sticky left-0 z-10 bg-zinc-950 px-3 py-1.5 font-mono text-xs text-zinc-500">
                      <span className="flex items-center gap-1.5">
                        <Handle {...drag.handle} />
                        {`{${k}}`}
                      </span>
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
                    <td className="px-2 py-1 text-center align-top">
                      <PlanCell n={numbers[k]} onToggle={() => togglePlan(k)} />
                    </td>
                    <td className="px-2 py-1 text-center align-top">
                      <button
                        type="button"
                        onClick={() => deleteVar(k)}
                        title={`Borrar {${k}} de todos los vuelos`}
                        aria-label={`Borrar ${k}`}
                        className="h-7 w-7 rounded-[2px] border border-zinc-800 text-[13px] text-zinc-600 hover:border-ko hover:text-ko"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                )}
              </DragList>
            </table>
          </div>
          <AddVar value={newFlightVar} onChange={setNewFlightVar} onSubmit={addFlightVar} />
        </section>
      </div>

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </main>
  );
}

type DragProps = {
  className: string;
  handle: { onMouseDown: () => void; onMouseUp: () => void };
};

/**
 * Lista reordenable arrastrando el asa de cada elemento. El elemento solo es
 * arrastrable mientras se mantiene pulsada el asa, para no estorbar a los
 * campos de texto que lleva dentro.
 */
function DragList({
  keys,
  onReorder,
  as = "div",
  children,
}: {
  keys: string[];
  onReorder: (next: string[]) => void;
  as?: "div" | "tbody";
  children: (k: string, drag: DragProps) => React.ReactElement;
}) {
  const [armed, setArmed] = useState(false);
  const [from, setFrom] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const drop = (target: string) => {
    if (from && from !== target) {
      const rest = keys.filter((x) => x !== from);
      const at = rest.indexOf(target) + (keys.indexOf(from) < keys.indexOf(target) ? 1 : 0);
      onReorder([...rest.slice(0, at), from, ...rest.slice(at)]);
    }
    setFrom(null);
    setOver(null);
    setArmed(false);
  };

  // Línea dorada en el hueco donde va a caer: antes o después del elemento
  // sobre el que está el ratón, según por dónde venga el que se arrastra.
  const line = (k: string) => {
    if (!from || from === k || over !== k) return "";
    const after = keys.indexOf(from) < keys.indexOf(k);
    if (as === "tbody") {
      return after
        ? "[&>td]:shadow-[inset_0_-2px_0_0_var(--color-gold)]"
        : "[&>td]:shadow-[inset_0_2px_0_0_var(--color-gold)]";
    }
    return `relative before:absolute before:inset-y-0 before:w-0.5 before:bg-gold ${
      after ? "before:-right-3" : "before:-left-3"
    }`;
  };

  const items = keys.map((k) => {
    const drag: DragProps = {
      className: from === k ? "opacity-40" : line(k),
      handle: { onMouseDown: () => setArmed(true), onMouseUp: () => setArmed(false) },
    };
    return cloneElement(children(k, drag), {
      key: k,
      draggable: armed || from === k,
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = "move";
        setFrom(k);
      },
      onDragEnd: () => {
        setFrom(null);
        setOver(null);
        setArmed(false);
      },
      onDragOver: (e: React.DragEvent) => {
        if (!from) return;
        e.preventDefault();
        setOver(k);
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        drop(k);
      },
    } as Record<string, unknown>);
  });

  if (as === "tbody") return <tbody>{items}</tbody>;
  return <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">{items}</div>;
}

/** Asa de arrastre: solo mientras se mantiene pulsada, el elemento es arrastrable. */
function Handle(props: { onMouseDown: () => void; onMouseUp: () => void }) {
  return (
    <span
      {...props}
      title="Arrastra para cambiar el orden"
      className="cursor-grab select-none px-0.5 text-zinc-600 hover:text-gold active:cursor-grabbing"
    >
      ⠿
    </span>
  );
}

/** Marca la variable para el plan de vuelo; el número es su posición entre las marcadas. */
function PlanCell({ n, onToggle }: { n: number | undefined; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={n ? `Puesto ${n} en el plan de vuelo · pulsa para quitarla` : "No sale en el plan de vuelo · pulsa para añadirla"}
      className={`h-7 w-10 shrink-0 rounded-[2px] border text-[12px] font-semibold ${
        n ? "border-gold/60 bg-gold/10 text-gold" : "border-dashed border-zinc-700 text-zinc-600 hover:border-gold hover:text-gold"
      }`}
    >
      {n ?? "—"}
    </button>
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
