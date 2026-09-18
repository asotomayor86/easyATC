"use client";

import { useCallback, useState } from "react";

/**
 * Cambios optimistas pendientes de confirmar por el servidor. Cada entrada
 * guarda cuándo respondió la petición; el primer sondeo que empiece después
 * ya trae el dato real y la entrada se descarta.
 */
export interface Pending<V> {
  value: V;
  settledAt: number | null;
}

export function useOverrides<V>() {
  const [map, setMap] = useState<Map<string, Pending<V>>>(new Map());

  const begin = useCallback((key: string, value: V): Pending<V> => {
    const entry: Pending<V> = { value, settledAt: null };
    setMap((m) => new Map(m).set(key, entry));
    return entry;
  }, []);

  const settle = useCallback((key: string, entry: Pending<V>) => {
    setMap((m) => (m.get(key) !== entry ? m : new Map(m).set(key, { ...entry, settledAt: Date.now() })));
  }, []);

  const fail = useCallback((key: string, entry: Pending<V>) => {
    setMap((m) => {
      if (m.get(key) !== entry) return m;
      const next = new Map(m);
      next.delete(key);
      return next;
    });
  }, []);

  /** Descarta lo confirmado antes de `pollStartedAt`. */
  const prune = useCallback((pollStartedAt: number) => {
    setMap((m) => {
      let next: Map<string, Pending<V>> | null = null;
      for (const [k, v] of m) {
        if (v.settledAt !== null && v.settledAt <= pollStartedAt) {
          next ??= new Map(m);
          next.delete(k);
        }
      }
      return next ?? m;
    });
  }, []);

  const clear = useCallback(() => setMap(new Map()), []);

  return { map, begin, settle, fail, prune, clear };
}

/** Superpone los cambios pendientes a los datos del servidor. `null` borra la clave. */
export function overlay<V>(base: Map<string, V>, pending: Map<string, Pending<V | null>>): Map<string, V> {
  if (pending.size === 0) return base;
  const out = new Map(base);
  for (const [k, p] of pending) {
    if (p.value === null) out.delete(k);
    else out.set(k, p.value);
  }
  return out;
}
