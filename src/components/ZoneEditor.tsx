"use client";

import { useState } from "react";
import { ZONE_KINDS, stackCell, toSlug, type Zone, type ZoneKind } from "@/lib/board";

const KIND_STYLE: Record<ZoneKind, { bar: string; badge: string }> = {
  entrada: { bar: "border-l-alt", badge: "border-alt/70 text-alt" },
  stack: { bar: "border-l-gold", badge: "border-gold/70 text-gold" },
  secuencia: { bar: "border-l-coord", badge: "border-coord/70 text-coord" },
  salida: { bar: "border-l-zinc-500", badge: "border-zinc-500 text-zinc-300" },
};

const input =
  "rounded-[2px] border border-zinc-700 bg-zinc-900 px-2 py-1 text-[13px] outline-none focus:border-gold";
const iconButton =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] border border-zinc-700 text-[10px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-30";

export function ZoneEditor({
  zone,
  first,
  last,
  refOptions,
  onChange,
  onMove,
  onDelete,
}: {
  zone: Zone;
  first: boolean;
  last: boolean;
  /** Zonas a las que puede apuntar: salidas para una entrada, entradas para una salida. */
  refOptions: { ref: string; label: string }[];
  onChange: (z: Zone) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const style = KIND_STYLE[zone.tipo];
  const set = (patch: Partial<Zone>) => onChange({ ...zone, ...patch });

  return (
    <div className={`rounded-[2px] border border-l-4 border-zinc-800 bg-zinc-900/60 ${style.bar}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-2 py-2">
        <span className={`kicker rounded-[2px] border px-1.5 py-[3px] text-[10px] ${style.badge}`}>
          {ZONE_KINDS.find((k) => k.kind === zone.tipo)?.label}
        </span>
        <input
          value={zone.nombre}
          onChange={(e) => set({ nombre: e.target.value })}
          placeholder="Nombre"
          aria-label="Nombre de la zona"
          className={`${input} min-w-0 flex-1 font-semibold`}
        />
        <span className="font-mono text-[11px] text-zinc-600" title="Identificador para enlazar entradas y salidas">
          {zone.id}
        </span>
        <div className="flex gap-1">
          <button type="button" className={iconButton} disabled={first} onClick={() => onMove(-1)} aria-label="Subir">
            ▲
          </button>
          <button type="button" className={iconButton} disabled={last} onClick={() => onMove(1)} aria-label="Bajar">
            ▼
          </button>
          <button type="button" className={`${iconButton} hover:border-ko hover:text-ko`} onClick={onDelete} aria-label="Quitar zona">
            ✕
          </button>
        </div>
      </div>

      <div className="space-y-2 px-2 py-2">
        {zone.tipo === "entrada" && (
          <RefSelect label="Viene de" value={zone.origen ?? null} options={refOptions} onChange={(origen) => set({ origen })} />
        )}
        {zone.tipo === "salida" && (
          <RefSelect label="Pasa a" value={zone.destino ?? null} options={refOptions} onChange={(destino) => set({ destino })} />
        )}
        {zone.tipo === "secuencia" && (
          <p className="text-[12px] text-zinc-500">Los vuelos se numeran 1.º, 2.º… por orden de llegada. No hay nada que configurar.</p>
        )}
        {zone.tipo === "stack" && <StackEditor zone={zone} onChange={set} />}
      </div>
    </div>
  );
}

/**
 * Stack: dos listas separadas por comas (puntos y bloques) y la rejilla que
 * resulta. Un clic en una celda la desactiva (o la vuelve a activar), para
 * los puntos que no tienen algún bloque.
 */
function StackEditor({ zone, onChange }: { zone: Zone; onChange: (patch: Partial<Zone>) => void }) {
  const puntos = zone.puntos ?? [];
  const bloques = zone.bloques ?? [];
  const off = new Set(zone.excluidos ?? []);

  const update = (next: { puntos?: string[]; bloques?: string[] }) => {
    const p = next.puntos ?? puntos;
    const b = next.bloques ?? bloques;
    const cells = new Set(p.flatMap((x) => b.map((y) => stackCell(x, y))));
    onChange({ ...next, excluidos: (zone.excluidos ?? []).filter((c) => cells.has(c)) });
  };
  const toggle = (cell: string) =>
    onChange({ excluidos: off.has(cell) ? [...off].filter((c) => c !== cell) : [...off, cell] });

  return (
    <div className="space-y-2">
      <ListInput label="Puntos" placeholder="Norte, Este" value={puntos} onChange={(v) => update({ puntos: v })} />
      <ListInput label="Bloques" placeholder="FL080, FL090, FL100" value={bloques} onChange={(v) => update({ bloques: v })} />
      {puntos.length > 0 && bloques.length > 0 && (
        <div className="overflow-x-auto">
          <div
            className="grid min-w-max gap-1 text-[11px]"
            style={{ gridTemplateColumns: `auto repeat(${puntos.length}, minmax(72px, 1fr))` }}
          >
            <span />
            {puntos.map((p) => (
              <span key={p} className="kicker text-center text-[10px] text-zinc-300">
                {p}
              </span>
            ))}
            {bloques.map((b) => (
              <Cells key={b}>
                <span className="kicker flex items-center pr-2 text-[10px] text-zinc-300">{b}</span>
                {puntos.map((p) => {
                  const cell = stackCell(p, b);
                  const active = !off.has(cell);
                  return (
                    <button
                      key={cell}
                      type="button"
                      onClick={() => toggle(cell)}
                      title={active ? `${p} · ${b}: pulsa para desactivar` : `${p} · ${b}: desactivada, pulsa para activar`}
                      className={`h-7 rounded-[2px] border text-[11px] ${
                        active ? "border-gold/50 bg-gold/10 text-gold" : "border-dashed border-zinc-800 text-zinc-700"
                      }`}
                    >
                      {active ? "✓" : "—"}
                    </button>
                  );
                })}
              </Cells>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-zinc-600">Pulsa una celda para quitarla si ese punto no tiene ese bloque.</p>
        </div>
      )}
    </div>
  );
}

function Cells({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/** Lista de nombres escrita con comas; se guarda al salir del campo. */
function ListInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const joined = value.join(", ");
  const [text, setText] = useState(joined);
  const [error, setError] = useState<string | null>(null);
  const commit = () => {
    const names = text
      .split(",")
      .map((s) => s.trim())
      .filter((s) => toSlug(s));
    const dup = names.find((n, i) => names.findIndex((m) => toSlug(m) === toSlug(n)) !== i);
    if (dup) return setError(`«${dup}» está repetido.`);
    setError(null);
    setText(names.join(", "));
    if (names.join(", ") !== joined) onChange(names);
  };
  return (
    <label className="flex flex-wrap items-center gap-2 text-[12px]">
      <span className="kicker w-20 text-[10px] text-zinc-400">{label}</span>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder={placeholder}
        className={`${input} min-w-0 flex-1 ${error ? "border-ko" : ""}`}
      />
      {error && <span className="w-full pl-[88px] text-[11px] text-ko">{error}</span>}
    </label>
  );
}

function RefSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: { ref: string; label: string }[];
  onChange: (v: string | null) => void;
}) {
  const broken = value !== null && !options.some((o) => o.ref === value);
  return (
    <label className="flex flex-wrap items-center gap-2 text-[12px]">
      <span className="kicker w-20 text-[10px] text-zinc-400">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className={`${input} min-w-0 flex-1 ${broken ? "border-ko text-ko" : ""}`}
      >
        <option value="">— ninguna —</option>
        {broken && <option value={value}>{value} (no existe)</option>}
        {options.map((o) => (
          <option key={o.ref} value={o.ref}>
            {o.ref} · {o.label.split(" · ")[1]}
          </option>
        ))}
      </select>
      {broken && <span className="text-ko">la zona enlazada no existe</span>}
    </label>
  );
}
