/** Resumen «12 OK · 3 WARN · 1 KO». Los ceros se atenúan. */
export function StatusCounts({ ok, warn, ko }: { ok: number; warn: number; ko: number }) {
  const item = (n: number, label: string, color: string) => (
    <span className={n ? color : "text-zinc-700"}>
      {n} {label}
    </span>
  );
  return (
    <span className="kicker inline-flex items-center gap-1.5 text-[10px] whitespace-nowrap">
      {item(ok, "OK", "text-ok")}
      <span className="text-zinc-700">·</span>
      {item(warn, "WARN", "text-warn")}
      <span className="text-zinc-700">·</span>
      {item(ko, "KO", "text-ko")}
    </span>
  );
}
