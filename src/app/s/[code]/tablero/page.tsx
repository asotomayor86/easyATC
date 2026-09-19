"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog, type ConfirmRequest } from "@/components/ConfirmDialog";
import { Nav } from "@/components/Nav";
import { ZoneEditor } from "@/components/ZoneEditor";
import {
  FLIGHT_COLORS,
  ZONE_KINDS,
  newZone,
  parseBoardFile,
  toBoardFile,
  validateZones,
  zoneRefs,
  type Board,
  type Zone,
  type ZoneKind,
} from "@/lib/board";
import { api, useSessionData } from "@/lib/client";
import { downloadJson, readJson, slug, stamp } from "@/lib/files";
import { AGENCY_LIST, agencyChannel } from "@/lib/guion";

type SaveState = { state: "saving" | "saved" | "error"; message?: string };
type Colors = NonNullable<Board["colores"]>;

const SAVE_DELAY = 700;

export default function TableroPage() {
  const code = String(useParams<{ code: string }>().code).toUpperCase();
  const { data, error, reload } = useSessionData(code);

  // Copia local del tablero: se edita aquí y se guarda por agencia poco después.
  const [zonas, setZonas] = useState<Record<string, Zone[]> | null>(null);
  const [colores, setColores] = useState<Colors>([]);
  const zonasRef = useRef<Record<string, Zone[]>>({});
  const [saving, setSaving] = useState<Record<string, SaveState>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Zonas escritas pero aún no enviadas, por agencia.
  const pending = useRef<Record<string, Zone[]>>({});
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadBoard = (b: Board | undefined) => {
    zonasRef.current = b?.zonas ?? {};
    setZonas(zonasRef.current);
    setColores(b?.colores ?? []);
  };

  useEffect(() => {
    if (data && zonas === null) loadBoard(data.session.board);
  }, [data, zonas]);

  // Si se sale de la página con cambios sin enviar, se envían en ese momento.
  useEffect(() => {
    const flush = () => {
      for (const [agency, zonasPendientes] of Object.entries(pending.current)) {
        clearTimeout(timers.current[agency]);
        fetch(`/api/s/${code}/board`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agency, zonas: zonasPendientes }),
          keepalive: true,
        });
      }
      pending.current = {};
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [code]);

  function save(agency: string, next: Zone[]) {
    clearTimeout(timers.current[agency]);
    const local = validateZones(next, agency);
    if (!local.ok) {
      delete pending.current[agency];
      setSaving((s) => ({ ...s, [agency]: { state: "error", message: local.error } }));
      return;
    }
    setSaving((s) => ({ ...s, [agency]: { state: "saving" } }));
    pending.current[agency] = next;
    timers.current[agency] = setTimeout(async () => {
      delete pending.current[agency];
      try {
        await api(`/api/s/${code}/board`, "PATCH", { agency, zonas: next });
        setSaving((s) => ({ ...s, [agency]: { state: "saved" } }));
      } catch {
        setSaving((s) => ({ ...s, [agency]: { state: "error", message: "No se pudo guardar." } }));
      }
    }, SAVE_DELAY);
  }

  function update(agency: string, fn: (zones: Zone[]) => Zone[]) {
    const next = fn(zonasRef.current[agency] ?? []);
    zonasRef.current = { ...zonasRef.current, [agency]: next };
    setZonas(zonasRef.current);
    save(agency, next);
  }

  async function saveColors(next: Colors) {
    setColores(next);
    try {
      await api(`/api/s/${code}/board`, "PATCH", { colores: next });
    } catch {
      setMessage({ ok: false, text: "No se pudieron guardar los colores." });
    }
  }

  const board: Board = useMemo(() => ({ zonas: zonas ?? {}, colores }), [zonas, colores]);
  const salidas = useMemo(() => zoneRefs(board, "salida"), [board]);
  const entradas = useMemo(() => zoneRefs(board, "entrada"), [board]);

  if (error) return <p className="p-6 text-ko">{error}</p>;
  if (!data || !zonas) return <p className="p-6 text-zinc-500">Cargando…</p>;

  const totalZones = Object.values(zonas).reduce((n, z) => n + z.length, 0);

  function exportBoard() {
    const file = toBoardFile(board);
    downloadJson(`easyATC_${code}_${slug(data!.session.name)}_tablero_${totalZones}zonas_${stamp()}.json`, file);
    setMessage({ ok: true, text: `Exportado: ${totalZones} zonas en ${AGENCY_LIST.length} agencias.` });
  }

  async function importBoard(file: File) {
    setMessage(null);
    const read = await readJson(file);
    if (!read.ok) return setMessage({ ok: false, text: read.error });
    const parsed = parseBoardFile(read.json);
    if (!parsed.ok) return setMessage({ ok: false, text: `${file.name}: ${parsed.error}` });
    const n = Object.values(parsed.value.zonas).reduce((acc, z) => acc + z.length, 0);
    setConfirm({
      message: `Importar ${file.name} (${n} zonas) sustituye el tablero de todas las agencias y los colores de los vuelos. Las marcas y el guion no se tocan. ¿Continuar?`,
      confirmLabel: "Importar",
      onConfirm: async () => {
        try {
          Object.values(timers.current).forEach(clearTimeout);
          pending.current = {};
          const r = await api<{ board: Board }>(`/api/s/${code}/board`, "PATCH", { file: read.json });
          loadBoard(r.board);
          setSaving({});
          setMessage({ ok: true, text: `Importado ${file.name}: ${n} zonas.` });
          reload();
        } catch {
          setMessage({ ok: false, text: "No se pudo importar: el servidor rechazó el archivo o no hay conexión." });
        }
      },
    });
  }

  const fileButton =
    "kicker rounded-[2px] border border-zinc-600 px-2.5 py-1.5 text-[11px] text-zinc-300 hover:border-gold hover:text-gold";

  return (
    <main className="mx-auto max-w-[96rem] px-4 py-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="kicker text-gold">{data.session.code}</p>
          <h1 className="font-cond text-[30px] leading-tight font-extrabold uppercase">Tablero · {totalZones} zonas</h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Nav code={code} current="tablero" />
          <div className="flex gap-1.5">
            <button type="button" onClick={exportBoard} className={fileButton}>
              ↓ Exportar tablero
            </button>
            <button type="button" onClick={() => fileInput.current?.click()} className={fileButton}>
              ↑ Importar tablero
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) importBoard(f);
              }}
            />
          </div>
          {message && <p className={`text-[12px] ${message.ok ? "text-ok" : "text-ko"}`}>{message.text}</p>}
        </div>
      </header>

      <div className="mb-8 grid gap-2 rounded-[2px] border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-[13px] text-zinc-400 sm:grid-cols-2 lg:grid-cols-4">
        {ZONE_KINDS.map((k) => (
          <p key={k.kind}>
            <span className="kicker mr-1.5 text-zinc-200">{k.label}</span>
            {k.hint}
          </p>
        ))}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        {AGENCY_LIST.map((a) => (
          <AgencyBoard
            key={a.id}
            agency={a.id}
            name={a.nombre}
            channel={agencyChannel(a.id, data.session.vars)}
            controller={a.controlador}
            zones={zonas[a.id] ?? []}
            saveState={saving[a.id]}
            salidas={salidas}
            entradas={entradas}
            onUpdate={(fn) => update(a.id, fn)}
            onDelete={(z) =>
              setConfirm({
                message: `¿Quitar la zona «${z.nombre || z.id}» de ${a.id}?`,
                confirmLabel: "Quitar",
                onConfirm: () => update(a.id, (zs) => zs.filter((x) => x !== z)),
              })
            }
          />
        ))}
      </div>

      <div className="mt-10 max-w-xl">
        <section>
          <h2 className="kicker mb-3 text-gold">Colores de los vuelos</h2>
          <div className="space-y-1.5">
            {data.flights.map((f) => {
              const key = (f.vars.corto || f.callsign).toUpperCase();
              const current = colores.find((c) => c.vuelo === key)?.color ?? "";
              return (
                <label key={f.id} className="flex items-center gap-3 rounded-[2px] border border-zinc-800 bg-zinc-900/60 px-3 py-1.5">
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-zinc-600"
                    style={{ background: FLIGHT_COLORS[current] ?? "transparent" }}
                  />
                  <span className="flex-1 font-cond text-[15px] font-semibold">{f.callsign}</span>
                  <select
                    value={current}
                    onChange={(e) =>
                      saveColors([
                        ...colores.filter((c) => c.vuelo !== key),
                        ...(e.target.value ? [{ vuelo: key, color: e.target.value }] : []),
                      ])
                    }
                    className="rounded-[2px] border border-zinc-700 bg-zinc-900 px-2 py-1 text-[13px] outline-none focus:border-gold"
                  >
                    <option value="">— sin color —</option>
                    {Object.keys(FLIGHT_COLORS).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
        </section>
      </div>

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </main>
  );
}

function AgencyBoard({
  agency,
  name,
  channel,
  controller,
  zones,
  saveState,
  salidas,
  entradas,
  onUpdate,
  onDelete,
}: {
  agency: string;
  name: string;
  channel: string;
  controller: string;
  zones: Zone[];
  saveState: SaveState | undefined;
  salidas: { ref: string; label: string }[];
  entradas: { ref: string; label: string }[];
  onUpdate: (fn: (zones: Zone[]) => Zone[]) => void;
  onDelete: (z: Zone) => void;
}) {
  const [kind, setKind] = useState<ZoneKind>("stack");
  const [newName, setNewName] = useState("");

  return (
    <section className="rounded-[2px] border border-zinc-800 bg-zinc-900/50">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-l-4 border-zinc-800 border-l-gold bg-zinc-900 px-3 py-2">
        <div>
          <p className="kicker text-[10px] text-gold">
            {agency} · Canal {channel} · {controller}
          </p>
          <h2 className="font-cond text-[20px] leading-tight font-bold tracking-wide uppercase">{name}</h2>
        </div>
        <span
          className={`kicker text-[10px] ${
            saveState?.state === "error" ? "text-ko" : saveState?.state === "saving" ? "text-zinc-400" : "text-ok"
          }`}
        >
          {saveState?.state === "saving" ? "Guardando…" : saveState?.state === "saved" ? "Guardado" : ""}
        </span>
      </header>
      {saveState?.state === "error" && (
        <p className="border-b border-zinc-800 bg-ko/10 px-3 py-1.5 text-[12px] text-ko">{saveState.message}</p>
      )}

      <div className="space-y-2 p-3">
        {zones.length === 0 && <p className="text-[13px] text-zinc-500">Sin zonas.</p>}
        {zones.map((z, i) => (
          <ZoneEditor
            key={i}
            zone={z}
            first={i === 0}
            last={i === zones.length - 1}
            refOptions={z.tipo === "entrada" ? salidas : entradas}
            onChange={(nz) => onUpdate((zs) => zs.map((x, j) => (j === i ? nz : x)))}
            onMove={(dir) =>
              onUpdate((zs) => {
                const j = i + dir;
                if (j < 0 || j >= zs.length) return zs;
                const next = [...zs];
                [next[i], next[j]] = [next[j], next[i]];
                return next;
              })
            }
            onDelete={() => onDelete(z)}
          />
        ))}

        <form
          className="flex flex-wrap gap-1.5 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            onUpdate((zs) => [...zs, newZone(kind, newName.trim(), zs.map((z) => z.id))]);
            setNewName("");
          }}
        >
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ZoneKind)}
            aria-label="Tipo de zona nueva"
            className="rounded-[2px] border border-zinc-700 bg-zinc-900 px-2 py-1 text-[13px] outline-none focus:border-gold"
          >
            {ZONE_KINDS.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </select>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre de la zona nueva"
            className="min-w-0 flex-1 rounded-[2px] border border-zinc-700 bg-zinc-900 px-2 py-1 text-[13px] outline-none focus:border-gold"
          />
          <button className="kicker rounded-[2px] border border-zinc-600 px-3 py-1 text-[11px] text-zinc-300 hover:border-gold hover:text-gold">
            + Añadir zona
          </button>
        </form>
      </div>
    </section>
  );
}
