"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AgencyChips } from "@/components/AgencyChips";
import { ConfirmDialog, type ConfirmRequest } from "@/components/ConfirmDialog";
import { Rails } from "@/components/Rails";
import { StatusCounts } from "@/components/StatusCounts";
import { StepRow, type SetStatus } from "@/components/StepRow";
import { api, clientId, useSessionData } from "@/lib/client";
import { AGENCY_LIST, agencyChannel, agencyName } from "@/lib/guion";
import { overlay, useOverrides } from "@/lib/optimistic";
import {
  buildRows,
  foldKey,
  groupByAgency,
  groupByFlight,
  progressForRole,
  progressOf,
  rowKey,
  type AgencyGroup,
  type Progress,
} from "@/lib/progress";
import {
  ROLES,
  type AgencyStateName,
  type Flight,
  type Mark,
  type MarkStatus,
  type Role,
  type StateData,
  type Step,
  type Vars,
} from "@/lib/types";

const POLL_MS = 2500;

/** scrollLeft que deja la columna `i` centrada en el carrusel. */
function columnTarget(track: HTMLElement, i: number) {
  const col = track.querySelector<HTMLElement>(`[data-col="${i}"]`);
  if (!col) return null;
  return col.offsetLeft + col.offsetWidth / 2 - track.clientWidth / 2;
}

const NEXT_STATE_VERB: Record<AgencyStateName, string> = {
  abierta: "abrirla",
  finalizada: "finalizarla",
  cerrada: "cerrarla",
};

export default function ControllerPage() {
  const code = String(useParams<{ code: string }>().code).toUpperCase();
  const { data, error, reload } = useSessionData(code);

  // --- Rol, guardado por sesión en localStorage ---
  const roleKey = `easyatc:role:${code}`;
  const [role, setRoleState] = useState<Role | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [railsOpen, setRailsOpen] = useState(true);
  useEffect(() => {
    try {
      const r = localStorage.getItem(roleKey);
      if (r && (ROLES as string[]).includes(r)) setRoleState(r as Role);
      const rails = localStorage.getItem("easyatc:rails");
      setRailsOpen(rails ? rails === "1" : true);
    } catch {}
    setRoleLoaded(true);
  }, [roleKey]);
  const setRole = (r: Role | null) => {
    setRoleState(r);
    try {
      if (r) localStorage.setItem(roleKey, r);
      else localStorage.removeItem(roleKey);
    } catch {}
    window.scrollTo({ top: 0 });
  };
  const toggleRails = () => {
    setRailsOpen((o) => {
      try {
        localStorage.setItem("easyatc:rails", o ? "0" : "1");
      } catch {}
      return !o;
    });
  };

  // --- Estado sincronizado por sondeo ---
  const [serverMarks, setServerMarks] = useState<Map<string, Mark>>(new Map());
  const [serverAgencies, setServerAgencies] = useState<Map<string, AgencyStateName>>(new Map());
  const markOv = useOverrides<Mark | null>();
  const agencyOv = useOverrides<AgencyStateName>();
  const [presence, setPresence] = useState<Record<Role, number>>({ C1: 0, C2: 0, C3: 0 });
  const [offline, setOffline] = useState(false);
  const [synced, setSynced] = useState(false);
  const lastUpdated = useRef<string | null>(null);
  const lastContent = useRef<string | null>(null);
  const roleRef = useRef(role);
  roleRef.current = role;
  const { prune: pruneMarks } = markOv;
  const { prune: pruneAgencies } = agencyOv;

  const poll = useCallback(async () => {
    const started = Date.now();
    try {
      const qs = new URLSearchParams({ cid: clientId() });
      if (roleRef.current) qs.set("role", roleRef.current);
      const st = await api<StateData>(`/api/s/${code}/state?${qs}`);
      setOffline(false);
      setSynced(true);

      if (st.updatedAt !== lastUpdated.current) {
        lastUpdated.current = st.updatedAt;
        setServerMarks(new Map(st.marks.map((m) => [rowKey(m.stepId, m.flightId), m])));
        setServerAgencies(new Map(st.agencies.map((a) => [a.agency, a.state])));
      }
      if (lastContent.current && st.contentAt !== lastContent.current) reload();
      lastContent.current = st.contentAt;

      setPresence((p) =>
        p.C1 === st.presence.C1 && p.C2 === st.presence.C2 && p.C3 === st.presence.C3 ? p : st.presence,
      );
      pruneMarks(started);
      pruneAgencies(started);
    } catch {
      setOffline(true);
    }
  }, [code, reload, pruneMarks, pruneAgencies]);

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

  useEffect(() => {
    if (role) poll();
  }, [role, poll]);

  const marks = useMemo(() => overlay(serverMarks, markOv.map), [serverMarks, markOv.map]);
  const agencyStates = useMemo(() => overlay(serverAgencies, agencyOv.map), [serverAgencies, agencyOv.map]);

  // --- Confirmación para tocar lo que no es tuyo ---
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const closeConfirm = useCallback(() => setConfirm(null), []);

  const { begin: beginMark, settle: settleMark, fail: failMark } = markOv;
  const applyMark = useCallback(
    async (step: Step, flight: Flight | null, status: MarkStatus | null) => {
      const r = roleRef.current ?? "C1";
      const k = rowKey(step.id, flight?.id ?? null);
      const mark: Mark | null = status
        ? { stepId: step.id, flightId: flight?.id ?? null, status, doneAt: new Date().toISOString(), doneBy: r }
        : null;
      const entry = beginMark(k, mark);
      try {
        await api(`/api/s/${code}/marks`, "PATCH", { stepId: step.id, flightId: flight?.id ?? null, status, role: r });
        settleMark(k, entry);
        poll();
      } catch {
        failMark(k, entry);
        setOffline(true);
      }
    },
    [code, poll, beginMark, settleMark, failMark],
  );

  const onSet: SetStatus = useCallback(
    (step, flight, status) => {
      if (step.controller === roleRef.current) return void applyMark(step, flight, status);
      setConfirm({
        message: `Esta transmisión es de ${step.controller} (${agencyName(step.agency)}). ¿${
          status ? "Marcar" : "Desmarcar"
        } de todas formas?`,
        confirmLabel: status ? "Marcar" : "Desmarcar",
        onConfirm: () => applyMark(step, flight, status),
      });
    },
    [applyMark],
  );

  const { begin: beginAgency, settle: settleAgency, fail: failAgency } = agencyOv;
  const applyAgency = useCallback(
    async (agency: string, state: AgencyStateName) => {
      const r = roleRef.current ?? "C1";
      const entry = beginAgency(agency, state);
      try {
        await api(`/api/s/${code}/agencies`, "PATCH", { agency, state, role: r });
        settleAgency(agency, entry);
        poll();
      } catch {
        failAgency(agency, entry);
        setOffline(true);
      }
    },
    [code, poll, beginAgency, settleAgency, failAgency],
  );

  const onAgencySet = useCallback(
    (agency: string, next: AgencyStateName) => {
      const cur = agencyStates.get(agency) ?? "cerrada";
      if (cur === next) return;
      const owner = AGENCY_LIST.find((a) => a.id === agency)?.controlador;
      if (owner === roleRef.current) return void applyAgency(agency, next);
      setConfirm({
        message: `${agencyName(agency)} es de ${owner}. Está ${cur}: ¿${NEXT_STATE_VERB[next]} de todas formas?`,
        confirmLabel: NEXT_STATE_VERB[next].replace(/la$/, "").replace(/^./, (c) => c.toUpperCase()),
        onConfirm: () => applyAgency(agency, next),
      });
    },
    [agencyStates, applyAgency],
  );

  function reset() {
    setConfirm({
      message: "¿Borrar TODAS las marcas y cerrar todas las agencias? Las variables y los textos no se tocan.",
      confirmLabel: "Borrar",
      onConfirm: async () => {
        await api(`/api/s/${code}/reset`, "POST");
        markOv.clear();
        agencyOv.clear();
        poll();
      },
    });
  }

  // --- Carrusel de agencias: una en el centro, las vecinas a los lados ---
  const trackRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const currentRef = useRef(0);
  currentRef.current = current;

  // Desplazamiento animado: acelera un poco al principio y frena al final.
  const slide = useRef<{ frame: number } | null>(null);
  const stopSlide = useCallback(() => {
    if (!slide.current) return;
    cancelAnimationFrame(slide.current.frame);
    slide.current = null;
    if (trackRef.current) trackRef.current.style.scrollSnapType = "";
  }, []);

  const goTo = useCallback(
    (i: number, animate = true) => {
      const track = trackRef.current;
      const count = track?.querySelectorAll("[data-col]").length ?? 0;
      if (!track || count === 0) return;
      const idx = Math.max(0, Math.min(count - 1, i));
      setCurrent(idx);
      const to = columnTarget(track, idx);
      if (to === null) return;
      stopSlide();
      const from = track.scrollLeft;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!animate || reduced || Math.abs(to - from) < 2) {
        track.scrollLeft = to;
        return;
      }
      // Unos 320 ms a la vecina, algo más cuanto más lejos, con tope.
      const steps = Math.abs(to - from) / Math.max(1, track.clientWidth / 2);
      const duration = Math.min(650, 260 + 60 * steps);
      const start = performance.now();
      // Sin imán mientras dura: si no, el navegador corrige cada fotograma.
      track.style.scrollSnapType = "none";
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = (1 - Math.cos(Math.PI * t)) / 2; // seno: entrada y salida suaves
        track.scrollLeft = from + (to - from) * eased;
        if (t < 1) slide.current = { frame: requestAnimationFrame(tick) };
        else stopSlide();
      };
      slide.current = { frame: requestAnimationFrame(tick) };
    },
    [stopSlide],
  );

  // Si el usuario toca o usa la rueda a mitad de animación, manda su gesto.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const cancel = () => stopSlide();
    track.addEventListener("wheel", cancel, { passive: true });
    track.addEventListener("touchstart", cancel, { passive: true });
    track.addEventListener("pointerdown", cancel);
    return () => {
      track.removeEventListener("wheel", cancel);
      track.removeEventListener("touchstart", cancel);
      track.removeEventListener("pointerdown", cancel);
    };
  });

  // Al deslizar con el dedo, la agencia que queda centrada pasa a ser la actual.
  const scrollFrame = useRef(0);
  const onTrackScroll = useCallback(() => {
    if (slide.current) return; // durante la animación, la actual ya está fijada
    cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(() => {
      const track = trackRef.current;
      if (!track) return;
      const count = track.querySelectorAll("[data-col]").length;
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < count; i++) {
        const d = Math.abs((columnTarget(track, i) ?? 0) - track.scrollLeft);
        if (d < bestDist) [best, bestDist] = [i, d];
      }
      setCurrent(best);
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea") || document.querySelector("[role=alertdialog]")) return;
      if (e.key === "ArrowLeft") goTo(currentRef.current - 1);
      if (e.key === "ArrowRight") goTo(currentRef.current + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo]);

  // --- Grupos de vuelo plegados, recordados en este navegador ---
  const foldStore = `easyatc:fold:${code}`;
  const [folded, setFolded] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      setFolded(new Set(JSON.parse(localStorage.getItem(foldStore) ?? "[]")));
    } catch {}
  }, [foldStore]);
  const updateFolded = useCallback(
    (fn: (s: Set<string>) => Set<string>) =>
      setFolded((prev) => {
        const next = fn(prev);
        try {
          localStorage.setItem(foldStore, JSON.stringify([...next]));
        } catch {}
        return next;
      }),
    [foldStore],
  );
  const toggleFold = useCallback(
    (key: string) =>
      updateFolded((s) => {
        const n = new Set(s);
        if (n.has(key)) n.delete(key);
        else n.add(key);
        return n;
      }),
    [updateFolded],
  );
  const foldMany = useCallback(
    (keys: string[], fold: boolean) =>
      updateFolded((s) => {
        const n = new Set(s);
        for (const k of keys) {
          if (fold) n.add(k);
          else n.delete(k);
        }
        return n;
      }),
    [updateFolded],
  );
  // Fila → grupo que la contiene, para desplegarlo antes de saltar a ella.
  const rowFoldKey = useRef(new Map<string, string>());

  // --- Saltar a una fila: centra su agencia, baja hasta ella y la resalta un segundo ---
  const [highlight, setHighlight] = useState<string | null>(null);
  const hlTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const jumpTo = useCallback(
    (key: string | null) => {
      if (!key) return;
      const fk = rowFoldKey.current.get(key);
      if (fk) flushSync(() => foldMany([fk], false));
      const el = document.querySelector<HTMLElement>(`[data-row="${key}"]`);
      const col = el?.closest<HTMLElement>("[data-col]");
      if (!el || !col) return;
      goTo(Number(col.dataset.col));
      const sticky = col.querySelector("header")?.offsetHeight ?? 0;
      col.scrollTop += el.getBoundingClientRect().top - col.getBoundingClientRect().top - sticky - 8;
      setHighlight(key);
      clearTimeout(hlTimer.current);
      hlTimer.current = setTimeout(() => setHighlight(null), 1000);
    },
    [goTo, foldMany],
  );

  // --- Derivados ---
  const rows = useMemo(() => (data ? buildRows(data.steps, data.flights) : []), [data]);
  const groups = useMemo(() => groupByAgency(rows), [rows]);
  useMemo(() => {
    rowFoldKey.current = new Map(rows.map((r) => [r.key, foldKey(r.step.agency, r.flight?.id ?? "*")]));
  }, [rows]);
  const progress = useMemo(
    () => Object.fromEntries(ROLES.map((r) => [r, progressForRole(r, rows, marks)])) as Record<Role, Progress>,
    [rows, marks],
  );

  const centeredFor = useRef<Role | null>(null);
  useEffect(() => {
    if (!role || !synced || groups.length === 0 || centeredFor.current === role) return;
    centeredFor.current = role;
    const key = progress[role].firstPendingKey;
    let idx = groups.findIndex((g) => g.rows.some((r) => r.key === key));
    if (idx < 0) idx = groups.findIndex((g) => g.controller === role);
    requestAnimationFrame(() => goTo(Math.max(0, idx), false));
  }, [role, synced, groups, progress, goTo]);

  if (error) return <p className="p-6 text-ko">{error}</p>;
  if (!data || !roleLoaded) return <p className="p-6 text-zinc-500">Cargando…</p>;

  if (!role) {
    return <RolePicker name={data.session.name} code={code} progress={progress} presence={presence} onPick={setRole} />;
  }

  const mine = progress[role];

  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 border-b border-zinc-800 bg-zinc-950">
        <div className="mx-auto max-w-[96rem] px-3 pt-2 pb-2">
          {/* Barra de sesión */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="font-cond text-[17px] leading-none font-bold tracking-wide">
              EASY<span className="text-gold">ATC</span>
            </span>
            <span className="kicker rounded-[2px] border border-gold/60 px-1.5 py-[3px] text-gold">{code}</span>
            <button
              onClick={() => setRole(null)}
              title="Cambiar de controlador"
              className="rounded-[2px] border border-gold bg-gold px-2 py-[1px] font-cond text-[16px] font-bold text-zinc-950"
            >
              {role} ▾
            </button>
            {presence[role] > 1 && (
              <span className="kicker text-[10px] text-missing">
                {presence[role]} en {role}
              </span>
            )}
            {offline && <span className="kicker text-[10px] text-ko">Sin conexión</span>}

            <div className="flex min-w-[200px] flex-1 items-center gap-2">
              <span className="text-[13px] font-semibold">
                {mine.done}/{mine.total}
              </span>
              <div className="h-1 max-w-[240px] flex-1 bg-zinc-800">
                <div className="h-full bg-ok" style={{ width: `${mine.pct}%` }} />
              </div>
              <StatusCounts ok={mine.ok} warn={mine.warn} ko={mine.ko} na={mine.na} />
              <span className="hidden gap-3 border-l border-zinc-800 pl-3 md:flex">
                {ROLES.filter((r) => r !== role).map((r) => (
                  <span key={r} className="kicker text-zinc-500">
                    <span className="text-zinc-300">{r}</span> {progress[r].pct}%
                    {progress[r].warn > 0 && <span className="text-warn"> · {progress[r].warn} W</span>}
                    {progress[r].ko > 0 && <span className="text-ko"> · {progress[r].ko} KO</span>}
                  </span>
                ))}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <HeaderButton onClick={() => jumpTo(mine.firstPendingKey)} disabled={!mine.firstPendingKey}>
                Siguiente ↓
              </HeaderButton>
              <HeaderButton onClick={reset} tone="ko">
                Reset
              </HeaderButton>
              <Menu code={code} railsOpen={railsOpen} onToggleRails={toggleRails} />
            </div>
          </div>

          <div className="mt-2">
            <AgencyChips
              states={agencyStates}
              role={role}
              current={groups[current]?.agency}
              sessionVars={data.session.vars}
              onPress={(agency) => goTo(groups.findIndex((g) => g.agency === agency))}
            />
          </div>

          {railsOpen && (
            <div className="mt-2 border-t border-zinc-800 pt-2">
              <Rails steps={data.steps} flights={data.flights} marks={marks} role={role} onJump={jumpTo} />
            </div>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <SideButton dir="prev" target={groups[current - 1]} onClick={() => goTo(current - 1)} />
        <div
          ref={trackRef}
          onScroll={onTrackScroll}
          className="relative flex min-w-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden py-3"
        >
          <div aria-hidden className="w-[calc(50%-min(23rem,50vw-3.5rem))] shrink-0" />
          {groups.map((g, i) => (
            <div
              key={g.agency}
              data-col={i}
              className="h-full w-[min(46rem,calc(100vw-7rem))] shrink-0 snap-center overflow-y-auto"
            >
              <AgencySection
                group={g}
                mine={g.controller === role}
                state={agencyStates.get(g.agency) ?? "cerrada"}
                progress={progressOf(g.rows, marks, () => true)}
                sessionVars={data.session.vars}
                marks={marks}
                highlight={highlight}
                onSet={onSet}
                onSetState={onAgencySet}
                folded={folded}
                onToggleFold={toggleFold}
                onFoldMany={foldMany}
              />
            </div>
          ))}
          <div aria-hidden className="w-[calc(50%-min(23rem,50vw-3.5rem))] shrink-0" />
        </div>
        <SideButton dir="next" target={groups[current + 1]} onClick={() => goTo(current + 1)} />
      </div>

      <ConfirmDialog request={confirm} onClose={closeConfirm} />
    </div>
  );
}

const AgencySection = memo(function AgencySection({
  group,
  mine,
  state,
  progress,
  sessionVars,
  marks,
  highlight,
  onSet,
  onSetState,
  folded,
  onToggleFold,
  onFoldMany,
}: {
  group: AgencyGroup;
  mine: boolean;
  state: AgencyStateName;
  progress: Progress;
  sessionVars: Vars;
  marks: Map<string, Mark>;
  highlight: string | null;
  onSet: SetStatus;
  onSetState: (agency: string, state: AgencyStateName) => void;
  folded: Set<string>;
  onToggleFold: (key: string) => void;
  onFoldMany: (keys: string[], fold: boolean) => void;
}) {
  const flightGroups = groupByFlight(group.rows);
  const keys = flightGroups.map((g) => foldKey(group.agency, g.key));
  return (
    <section
      className={`min-w-0 rounded-[2px] border border-zinc-800 bg-zinc-900/50 ${mine ? "" : "opacity-[0.55]"}`}
    >
      <header
        className={`sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-l-4 border-zinc-800 bg-zinc-900 px-3 py-2 ${
          mine ? "border-l-gold" : "border-l-zinc-600"
        }`}
      >
        <div className="min-w-0">
          <p className="kicker text-[10px] text-gold">
            Canal {agencyChannel(group.agency, sessionVars)} · {group.controller} ·{" "}
            <span className={state === "abierta" ? "text-ok" : "text-zinc-500"}>{state}</span>
          </p>
          <h2 className="truncate font-cond text-[20px] leading-tight font-bold tracking-wide uppercase">
            {agencyName(group.agency)}
          </h2>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <FoldButton label="Desplegar todos los grupos" onClick={() => onFoldMany(keys, false)}>
            +
          </FoldButton>
          <FoldButton label="Plegar todos los grupos" onClick={() => onFoldMany(keys, true)}>
            −
          </FoldButton>
          <StateSwitch state={state} onChange={(st) => onSetState(group.agency, st)} />
          <Badge tone={mine ? "gold" : "mute"}>
            {progress.done}/{progress.total}
          </Badge>
          {progress.warn > 0 && <Badge tone="warn">{progress.warn} WARN</Badge>}
          {progress.ko > 0 && <Badge tone="ko">{progress.ko} KO</Badge>}
          {progress.na > 0 && <Badge tone="na">{progress.na} NA</Badge>}
        </div>
      </header>

      <div className="divide-y divide-zinc-800">
        {flightGroups.map((fg) => {
          const key = foldKey(group.agency, fg.key);
          const isFolded = folded.has(key);
          const p = progressOf(fg.rows, marks, () => true);
          return (
            <div key={fg.key}>
              <button
                type="button"
                onClick={() => onToggleFold(key)}
                aria-expanded={!isFolded}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 bg-zinc-900/80 px-3 py-2 text-left hover:bg-zinc-800/60"
              >
                <span className="w-3 text-[11px] text-gold">{isFolded ? "▶" : "▼"}</span>
                <span className="font-cond text-[16px] leading-none font-bold tracking-wide uppercase">
                  {fg.flight ? fg.flight.callsign : "Todas las estaciones"}
                </span>
                <span className="kicker text-[10px] text-zinc-400">
                  {p.done}/{p.total}
                </span>
                <span className="ml-auto">
                  <StatusCounts ok={p.ok} warn={p.warn} ko={p.ko} na={p.na} />
                </span>
              </button>
              {!isFolded && (
                <div className="divide-y divide-zinc-800/60 border-t border-zinc-800/60">
                  {fg.rows.map((r) => {
                    const step = r.step;
                    const coord = step.initiator === "coord";
                    return (
                      <article
                        key={r.key}
                        className={`border-l-2 ${coord ? "border-l-coord" : step.alt ? "border-l-alt" : "border-l-transparent"}`}
                      >
                        {(step.alt || coord || step.note) && (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 pt-1.5 text-[12px]">
                            {step.alt && <Badge tone="alt">Alternativa</Badge>}
                            {coord && <Badge tone="coord">Coordinación</Badge>}
                            {step.note && <span className="text-zinc-400">{step.note}</span>}
                          </div>
                        )}
                        <StepRow
                          rowKey={r.key}
                          step={step}
                          flight={r.flight}
                          mark={marks.get(r.key)}
                          sessionVars={sessionVars}
                          highlighted={highlight === r.key}
                          onSet={onSet}
                          showCallsign={false}
                        />
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
});

function SideButton({
  dir,
  target,
  onClick,
}: {
  dir: "prev" | "next";
  target: AgencyGroup | undefined;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!target}
      aria-label={target ? `Ir a ${agencyName(target.agency)}` : undefined}
      className={`flex w-10 shrink-0 flex-col items-center justify-center gap-2 border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-900 hover:text-gold disabled:opacity-20 sm:w-14 ${
        dir === "prev" ? "border-r" : "border-l"
      }`}
    >
      <span className="font-cond text-[44px] leading-none font-bold">{dir === "prev" ? "‹" : "›"}</span>
      {target && (
        <span className="kicker text-center text-[10px]">
          {target.agency}
          <span className="block text-zinc-600">{target.controller}</span>
        </span>
      )}
    </button>
  );
}

function FoldButton({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-[23px] w-[23px] items-center justify-center rounded-[2px] border border-zinc-700 font-cond text-[16px] leading-none font-bold text-zinc-300 hover:border-gold hover:text-gold"
    >
      {children}
    </button>
  );
}

const STATE_BUTTONS: { state: AgencyStateName; label: string; active: string }[] = [
  { state: "cerrada", label: "Cerrada", active: "border-zinc-500 bg-zinc-700 text-zinc-100" },
  { state: "abierta", label: "Abierta", active: "border-ok bg-ok text-zinc-950" },
  { state: "finalizada", label: "Finalizada", active: "border-zinc-500 bg-zinc-800 text-zinc-300" },
];

function StateSwitch({ state, onChange }: { state: AgencyStateName; onChange: (s: AgencyStateName) => void }) {
  return (
    <div role="group" aria-label="Estado de la agencia" className="flex">
      {STATE_BUTTONS.map((b, i) => (
        <button
          key={b.state}
          type="button"
          aria-pressed={state === b.state}
          onClick={() => onChange(b.state)}
          className={`tint kicker border px-2 py-[5px] text-[10px] ${i > 0 ? "-ml-px" : ""} ${
            state === b.state ? `relative z-[1] ${b.active}` : "border-zinc-700 text-zinc-500 hover:text-zinc-200"
          }`}
        >
          {b.state === "finalizada" && state === b.state ? "✓ " : ""}
          {b.label}
        </button>
      ))}
    </div>
  );
}

const BADGE_TONES = {
  gold: "border-gold/70 text-gold",
  warn: "border-warn/70 text-warn",
  ko: "border-ko/70 text-ko",
  na: "border-na/60 text-na",
  coord: "border-coord/70 text-coord",
  alt: "border-alt/70 text-alt",
  mute: "border-zinc-700 text-zinc-400",
};

function Badge({ tone, children }: { tone: keyof typeof BADGE_TONES; children: React.ReactNode }) {
  return (
    <span className={`kicker rounded-[2px] border px-1.5 py-[3px] text-[10px] whitespace-nowrap ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

function HeaderButton({
  children,
  onClick,
  disabled,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "ko";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`kicker rounded-[2px] border px-2.5 py-[7px] text-[11px] disabled:opacity-40 ${
        tone === "ko" ? "border-ko/50 text-ko hover:border-ko" : "border-zinc-600 text-zinc-200 hover:border-zinc-400"
      }`}
    >
      {children}
    </button>
  );
}

function RolePicker({
  name,
  code,
  progress,
  presence,
  onPick,
}: {
  name: string;
  code: string;
  progress: Record<Role, Progress>;
  presence: Record<Role, number>;
  onPick: (r: Role) => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[60rem] flex-col justify-center gap-6 px-4 py-10">
      <header>
        <p className="kicker text-gold">Sesión {code}</p>
        <h1 className="font-cond text-[34px] leading-tight font-extrabold uppercase">{name}</h1>
        <div className="mt-1 h-[3px] w-16 bg-gold" />
        <p className="mt-3 text-zinc-400">¿Qué controlador eres?</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        {ROLES.map((r) => {
          const agencies = AGENCY_LIST.filter((a) => a.controlador === r).map((a) => a.id);
          return (
            <button
              key={r}
              onClick={() => onPick(r)}
              className="rounded-[2px] border border-zinc-800 border-l-4 border-l-gold bg-zinc-900 px-4 py-4 text-left hover:border-zinc-600 hover:border-l-gold"
            >
              <span className="kicker block text-gold">{agencies.join(" · ")}</span>
              <span className="block font-cond text-[44px] leading-none font-extrabold">{r}</span>
              <span className="mt-2 block text-zinc-400">{progress[r].total} transmisiones</span>
              {presence[r] > 0 && (
                <span className="kicker mt-1 block text-missing">
                  {presence[r] === 1 ? "1 conectado" : `${presence[r]} conectados`}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex gap-4">
        <Link href={`/s/${code}/setup`} className="kicker text-zinc-400 hover:text-gold">
          Variables
        </Link>
        <Link href={`/s/${code}/guion`} className="kicker text-zinc-400 hover:text-gold">
          Guion
        </Link>
        <Link href="/" className="kicker text-zinc-500 hover:text-gold">
          Salir
        </Link>
      </div>
    </main>
  );
}

function Menu({ code, railsOpen, onToggleRails }: { code: string; railsOpen: boolean; onToggleRails: () => void }) {
  const item = "block w-full px-3 py-2.5 text-left hover:bg-zinc-800";
  return (
    <details className="relative">
      <summary className="kicker cursor-pointer list-none rounded-[2px] border border-zinc-600 px-2.5 py-[7px] text-[11px] text-zinc-200 [&::-webkit-details-marker]:hidden">
        ⋯
      </summary>
      <div className="absolute right-0 z-30 mt-1 w-44 rounded-[2px] border border-zinc-700 bg-zinc-900 text-[13px]">
        <button type="button" onClick={onToggleRails} className={item}>
          {railsOpen ? "Ocultar rieles" : "Mostrar rieles"}
        </button>
        <Link href={`/s/${code}/setup`} className={item}>
          Variables
        </Link>
        <Link href={`/s/${code}/guion`} className={item}>
          Guion
        </Link>
        <Link href="/" className={`${item} text-zinc-400`}>
          Salir
        </Link>
      </div>
    </details>
  );
}
