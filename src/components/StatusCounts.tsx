/** Resumen «12 OK · 3 WARN · 1 KO · 2 NA». Los ceros se atenúan. */
export function StatusCounts({ ok, warn, ko, na }: { ok: number; warn: number; ko: number; na: number }) {
  const item = (n: number, label: string, color: string) => (
    <span className={n ? color : "text-zinc-700"}>
      {n} {label}
    </span>
  );
  const dot = <span className="text-zinc-700">·</span>;
  return (
    <span className="kicker inline-flex items-center gap-1.5 text-[10px] whitespace-nowrap">
      {item(ok, "OK", "text-ok")}
      {dot}
      {item(warn, "WARN", "text-warn")}
      {dot}
      {item(ko, "KO", "text-ko")}
      {dot}
      {item(na, "NA", "text-na")}
    </span>
  );
}
