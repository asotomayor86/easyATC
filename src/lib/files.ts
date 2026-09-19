"use client";

/** «Sesión de ejemplo» → «sesion-de-ejemplo», para nombres de archivo. */
export function slug(s: string) {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "sesion"
  );
}

/** Fecha y hora locales para nombres de archivo: 2026-09-19_1030. */
export function stamp(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** Descarga un objeto como archivo JSON. */
export function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Lee un archivo elegido por el usuario como JSON. */
export async function readJson(file: File): Promise<{ ok: true; json: unknown } | { ok: false; error: string }> {
  try {
    return { ok: true, json: JSON.parse(await file.text()) };
  } catch {
    return { ok: false, error: `${file.name} no es un JSON válido.` };
  }
}
