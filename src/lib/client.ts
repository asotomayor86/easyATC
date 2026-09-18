"use client";

import { useCallback, useEffect, useState } from "react";
import type { SessionData } from "./types";

export async function api<T = unknown>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export function useSessionData(code: string) {
  const [data, setData] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await api<SessionData>(`/api/s/${code}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message === "404" ? "Sesión no encontrada" : "Error de conexión");
    }
  }, [code]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, reload, setData };
}

export function clientId(): string {
  try {
    let id = sessionStorage.getItem("easyatc:cid");
    if (!id) {
      id = Math.random().toString(36).slice(2, 12);
      sessionStorage.setItem("easyatc:cid", id);
    }
    return id;
  } catch {
    return "anon" + Math.random().toString(36).slice(2, 8);
  }
}
