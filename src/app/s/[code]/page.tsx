"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StepRow } from "@/components/StepRow";
import { api, clientId, useSessionData } from "@/lib/client";
import { agencyChannel, agencyName } from "@/lib/guion";
import { buildRows, progressFor, rowKey, type Row } from "@/lib/progress";
import { ROLES, type Flight, type Mark, type Role, type StateData, type Step } from "@/lib/types";

const POLL_MS = 2500;

interface Override {
  mark: Mark | null; // null = desmarcada
  settledAt: number | null; // cuándo respondió el servidor
}

export default function ControllerPage() {
  const code = String(useParams<{ code: string }>().code).toUpperCase();
  const { data, error, reload } = useSessionData(code);

  // --- Rol, guardado por sesión en localStorage ---
  const roleKey = `easyatc:role:${code}`;
  const [role, setRoleState] = useState<Role | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  useEffect(() => {
    const r = localStorage.getItem(roleKey);
    if (r && (ROLES as string[]).includes(r)) setRoleState(r as Role);
    setRoleLoaded(true);
  }, [roleKey]);
  const setRole = (r: Role | null) => {
    setRoleState(r);
    if (r) localStorage.setItem(roleKey, r);
    else localStorage.removeItem(roleKey);
    window.scrollTo({ top: 0 });
  };

  // --- Estado sincronizado por sondeo ---
  const [serverMarks, setServerMarks] = useState<Map<string, Mark>>(new Map());
  const [overrides, setOverrides] = useState<Map<string, Override>>(new Map());
  const [presence, setPresence] = useState<Record<Role, number>>({ C1: 0, C2: 0, C3: 0 });
  const [offline, setOffline] = useState(false);
  const lastUpdated = useRef<string | null>(null);
  const lastContent = useRef<string | null>(null);
  const roleRef = useRef(role);
  roleRef.current = role;

  const poll = useCallback(async () => {
    const started = Date.now();
    try {
      const qs = new URLSearchParams({ cid: clientId() });
      if (roleRef.current) qs.set("role", roleRef.current);
      const st = await api<StateData>(`/api/s/${code}/state?${qs}`);
      setOffline(false);

      if (st.updatedAt !== lastUpdated.current) {
        lastUpdated.current = st.updatedAt;
        setServerMarks(new Map(st.marks.map((m) => [rowKey(m.stepId, m.flightId), m])));
      }
      if (lastContent.current && st.contentAt !== lastContent.current) reload();
      lastContent.current = st.contentAt;

      setPresence((p) =>
        p.C1 === st.presence.C1 && p.C2 === st.presence.C2 && p.C3 === st.presence.C3 ? p : st.presence,
      );
      // Las marcas optimistas ya confirmadas antes de este sondeo dejan paso al servidor.
      setOverrides((o) => {
        if (o.size === 0) return o;
        let changed = false;
        const next = new Map(o);
        for (const [k, v] of o) {
          if (v.settledAt !== null && v.settledAt <= started) {
            next.delete(k);
            changed = true;
          }
        }
        return changed ? next : o;
      });
    } catch {
      setOffline(true);
    }
  }, [code, reload]);

  useEffect(() => {
    poll();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") poll();
    }, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [poll]);

  // Al cambiar de rol, anúncialo en seguida.
  useEffect(() => {
    if (role) poll();
  }, [role, poll]);

  const marks = useMemo(() => {
    if (overrides.size === 0) return serverMarks;
    const m = new Map(serverMarks);
    for (const [k, v] of overrides) {
      if (v.mark) m.set(k, v.mark);
      else m.delete(k);
    }
    return m;
  }, [serverMarks, overrides]);

  const onToggle = useCallback(
    async (step: Step, flight: Flight | null, done: boolean) => {
      const r = roleRef.current ?? "C1";
      const k = rowKey(step.id, flight?.id ?? null);
      const mark: Mark | null = done
        ? { stepId: step.id, flightId: flight?.id ?? null, doneAt: new Date().toISOString(), doneBy: r }
        : null;
      setOverrides((o) => new Map(o).set(k, { mark, settledAt: null }));
      try {
        await api(`/api/s/${code}/marks`, "POST", {
          stepId: step.id,
          flightId: flight?.id ?? null,
          done,
          role: r,
        });
        setOverrides((o) => {
          const cur = o.get(k);
          if (!cur || cur.mark !== mark) return o;
          return new Map(o).set(k, { mark, settledAt: Date.now() });
        });
        poll();
      } catch {
        setOverrides((o) => {
          const next = new Map(o);
          if (next.get(k)?.mark === mark) next.delete(k);
          return next;
        });
        setOffline(true);
      }
    },
    [code, poll],
  );

  async function reset() {
    if (!confirm("¿Borrar TODAS las marcas de la sesión? Las variables y los textos no se tocan.")) return;
    await api(`/api/s/${code}/reset`, "POST");
    setOverrides(new Map());
    poll();
  }

  // --- Derivados ---
  const rows = useMemo(() => (data ? buildRows(data.steps, data.flights) : []), [data]);
  const progress = useMemo(
    () => Object.fromEntries(ROLES.map((r) => [r, progressFor(r, rows, marks)])) as Record<Role, ReturnType<typeof progressFor>>,
    [rows, marks],
  );

  if (error) return <p className="p-6 text-red-400">{error}</p>;
  if (!data || !roleLoaded) return <p className="p-6 text-zinc-500">Cargando…</p>;

  if (!role) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[70rem] flex-col justify-center gap-8 px-4 py-10">
        <header className="text-center">
          <p className="font-mono text-sm tracking-widest text-zinc-500">{data.session.code}</p>
          <h1 className="text-2xl font-bold">{data.session.name}</h1>
          <p className="mt-2 text-zinc-400">¿Qué controlador eres?</p>
        </header>
        <div className="grid gap-4 sm:grid-cols-3">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className="rounded-2xl border-2 border-zinc-700 bg-zinc-900 px-6 py-10 text-center hover:border-emerald-400 active:bg-zinc-800"
            >
              <span className="block text-6xl font-black">{r}</span>
              <span className="mt-3 block text-lg text-zinc-400">{progress[r].total} transmisiones</span>
              {presence[r] > 0 && (
                <span className="mt-2 block text-sm text-amber-300">
                  {presence[r] === 1 ? "1 persona conectada" : `${presence[r]} personas conectadas`}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex justify-center">
          <Nav code={code} />
        </div>
      </main>
    );
  }

  const mine = progress[role];
  const myRows = rows.filter((r) => r.step.controller === role);
  const groups = groupByAgency(myRows);
  const others = ROLES.filter((r) => r !== role);

  return (
    <div className="pb-24">
      {/* Cabecera fija */}
      <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto max-w-[70rem] px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="font-mono text-sm tracking-widest text-zinc-400">{data.session.code}</span>
            <button
              onClick={() => setRole(null)}
              title="Cambiar de controlador"
              className="rounded-lg bg-emerald-500 px-3 py-1 text-lg font-black text-zinc-950"
            >
              {role} <span className="text-sm font-semibold">▾</span>
            </button>
            {presence[role] > 1 && (
              <span className="rounded bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
                {presence[role]} personas en {role}
              </span>
            )}
            {offline && (
              <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-300">Sin conexión</span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                disabled={!mine.firstPendingKey}
                onClick={() => jumpTo(mine.firstPendingKey)}
                className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
              >
                Siguiente ↓
              </button>
              <button
                onClick={reset}
                className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm font-semibold text-red-300 hover:bg-red-500/10"
              >
                Reset
              </button>
              <Menu code={code} />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full bg-emerald-500" style={{ width: `${mine.pct}%` }} />
            </div>
            <span className="font-mono text-sm text-zinc-300">
              {mine.done}/{mine.total}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[70rem] px-4 pt-4">
        {groups.map((g, i) => (
          <section key={`${g.agency}-${i}`} className="mb-6">
            <h2 className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-zinc-700 pb-1.5">
              <span className="text-lg font-bold">{agencyName(g.agency)}</span>
              <span className="font-mono text-base text-amber-200">Canal {agencyChannel(g.agency, data.session.vars)}</span>
            </h2>
            <div className="space-y-3">
              {groupBySteps(g.rows).map(({ step, rows }) => (
                <article
                  key={step.id}
                  className={`overflow-hidden rounded-xl border ${
                    step.alt ? "border-dashed border-amber-500/50" : "border-zinc-800"
                  } bg-zinc-900/60`}
                >
                  {step.alt && (
                    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-sm text-amber-200">
                      <span className="mr-2 rounded bg-amber-400/20 px-1.5 py-0.5 text-xs font-bold uppercase">
                        Alternativa
                      </span>
                      {step.note}
                    </div>
                  )}
                  {!step.alt && step.note && (
                    <div className="border-b border-zinc-800 px-4 py-1.5 text-sm text-zinc-400 italic">{step.note}</div>
                  )}
                  <div className="divide-y divide-zinc-800">
                    {rows.map((r) => (
                      <StepRow
                        key={r.key}
                        rowKey={r.key}
                        step={r.step}
                        flight={r.flight}
                        mark={marks.get(r.key)}
                        sessionVars={data.session.vars}
                        onToggle={onToggle}
                      />
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* Pie: estado de los otros */}
      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto grid max-w-[70rem] grid-cols-2 gap-4 px-4 py-2.5">
          {others.map((r) => {
            const p = progress[r];
            return (
              <div key={r} className="min-w-0">
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="font-black">{r}</span>
                  <span className="font-mono text-zinc-300">{p.pct}%</span>
                  <span className="truncate text-zinc-500">
                    {p.done === p.total && p.total > 0 ? "completo" : p.currentAgency ? agencyName(p.currentAgency) : ""}
                  </span>
                  {presence[r] === 0 && <span className="text-xs text-zinc-600">(nadie)</span>}
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full bg-sky-500" style={{ width: `${p.pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </footer>
    </div>
  );
}

function jumpTo(key: string | null) {
  if (!key) return;
  document.getElementById(`row-${key}`)?.scrollIntoView({ block: "start" });
}

function groupByAgency(rows: Row[]) {
  const groups: { agency: string; rows: Row[] }[] = [];
  for (const r of rows) {
    const last = groups[groups.length - 1];
    if (last && last.agency === r.step.agency) last.rows.push(r);
    else groups.push({ agency: r.step.agency, rows: [r] });
  }
  return groups;
}

function groupBySteps(rows: Row[]) {
  const out: { step: Step; rows: Row[] }[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last.step.id === r.step.id) last.rows.push(r);
    else out.push({ step: r.step, rows: [r] });
  }
  return out;
}

function Nav({ code }: { code: string }) {
  return (
    <div className="flex gap-4 text-sm">
      <Link href={`/s/${code}/setup`} className="text-sky-400 underline">
        Variables
      </Link>
      <Link href={`/s/${code}/guion`} className="text-sky-400 underline">
        Guion
      </Link>
      <Link href="/" className="text-zinc-400 underline">
        Salir
      </Link>
    </div>
  );
}

function Menu({ code }: { code: string }) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 [&::-webkit-details-marker]:hidden">
        ⋯
      </summary>
      <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 text-sm shadow-xl">
        <Link href={`/s/${code}/setup`} className="block px-4 py-2.5 hover:bg-zinc-800">
          Variables
        </Link>
        <Link href={`/s/${code}/guion`} className="block px-4 py-2.5 hover:bg-zinc-800">
          Guion
        </Link>
        <Link href="/" className="block px-4 py-2.5 text-zinc-400 hover:bg-zinc-800">
          Salir
        </Link>
      </div>
    </details>
  );
}
