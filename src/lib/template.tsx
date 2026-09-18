import type { ReactNode } from "react";
import type { Vars } from "./types";

type Segment =
  | { kind: "text"; value: string }
  | { kind: "missing"; value: string }
  | { kind: "blank"; value: string };

const TOKEN_RE = /\{([A-Za-z0-9_]+)\}|\[[^\]\n]+\]/g;

function lookup(key: string, flightVars: Vars, sessionVars: Vars): string | undefined {
  const get = (k: string) => {
    const f = flightVars[k];
    if (f != null && f !== "") return f;
    const s = sessionVars[k];
    if (s != null && s !== "") return s;
    return undefined;
  };

  if (key === "precede_sufijo") {
    const p = get("precede");
    return p ? `, tras ${p}` : "";
  }
  if (key === "salida_bs_corto") {
    const s = get("salida_bs");
    // Seis primeras palabras, sin la puntuación que arrastre la última.
    return s ? s.trim().split(/\s+/).slice(0, 6).join(" ").replace(/[\s,;.:]+$/, "") : undefined;
  }
  return get(key);
}

export function parseTemplate(text: string, flightVars: Vars, sessionVars: Vars): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    const i = m.index!;
    if (i > last) out.push({ kind: "text", value: text.slice(last, i) });
    if (m[1] !== undefined) {
      const v = lookup(m[1], flightVars, sessionVars);
      out.push(v === undefined ? { kind: "missing", value: m[0] } : { kind: "text", value: v });
    } else {
      out.push({ kind: "blank", value: m[0] });
    }
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out;
}

export function Rendered({
  text,
  flightVars,
  sessionVars,
}: {
  text: string;
  flightVars: Vars;
  sessionVars: Vars;
}): ReactNode {
  return parseTemplate(text, flightVars, sessionVars).map((seg, i) => {
    if (seg.kind === "missing")
      return (
        <mark key={i} className="rounded bg-amber-400/20 px-0.5 text-amber-300 ring-1 ring-amber-400/40">
          {seg.value}
        </mark>
      );
    if (seg.kind === "blank")
      return (
        <span key={i} className="text-zinc-500">
          {seg.value}
        </span>
      );
    return <span key={i}>{seg.value}</span>;
  });
}
