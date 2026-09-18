"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      const { code } = await res.json();
      router.push(`/s/${code}/setup`);
    } catch {
      setError("No se pudo crear la sesión.");
      setBusy(false);
    }
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(c)) {
      setError("El código tiene 6 caracteres.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/s/${c}`);
    if (res.ok) router.push(`/s/${c}`);
    else {
      setError(`No existe ninguna sesión ${c}.`);
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-lg outline-none focus:border-emerald-400";
  const button =
    "w-full rounded-lg px-4 py-3 text-lg font-semibold disabled:opacity-50";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-10 px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">easyATC</h1>
        <p className="mt-1 text-zinc-400">Seguimiento en vivo del ejercicio de control.</p>
      </header>

      <form onSubmit={join} className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Entrar con código</h2>
        <input
          className={`${input} font-mono uppercase tracking-[0.3em]`}
          placeholder="DEMO01"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoCapitalize="characters"
          autoComplete="off"
        />
        <button className={`${button} bg-emerald-500 text-zinc-950`} disabled={busy}>
          Entrar
        </button>
      </form>

      <form onSubmit={create} className="space-y-3 border-t border-zinc-800 pt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Crear sesión nueva</h2>
        <input
          className={input}
          placeholder="Nombre de la sesión"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
        <button className={`${button} border border-zinc-600 bg-zinc-800`} disabled={busy}>
          Crear y configurar
        </button>
      </form>

      {error && <p className="text-center text-red-400">{error}</p>}
    </main>
  );
}
