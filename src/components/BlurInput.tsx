"use client";

import { useState } from "react";

type Status = "idle" | "saving" | "saved" | "error";

const ring: Record<Status, string> = {
  idle: "border-zinc-700 focus:border-gold",
  saving: "border-gold",
  saved: "border-ok/60",
  error: "border-ko",
};

/** Campo que guarda al perder el foco, solo si el valor ha cambiado. */
export function BlurInput({
  value,
  onSave,
  multiline = false,
  className = "",
  placeholder,
  rows = 2,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
  rows?: number;
}) {
  const [saved, setSaved] = useState(value);
  const [status, setStatus] = useState<Status>("idle");

  async function commit(v: string) {
    if (v === saved) return;
    setStatus("saving");
    try {
      await onSave(v);
      setSaved(v);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  const cls = `w-full rounded-[2px] border bg-zinc-900 px-2.5 py-1.5 outline-none ${ring[status]} ${className}`;
  return multiline ? (
    <textarea
      defaultValue={value}
      rows={rows}
      placeholder={placeholder}
      className={`${cls} resize-y leading-snug`}
      onBlur={(e) => commit(e.target.value)}
    />
  ) : (
    <input
      defaultValue={value}
      placeholder={placeholder}
      className={cls}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
