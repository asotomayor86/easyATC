/**
 * Base de datos local para probar sin Neon (npm run dev:local): Postgres en el
 * propio proceso (PGlite), guardado en la carpeta .pglite. Solo se usa cuando
 * EASYATC_LOCAL=1, que hace que next.config.ts sustituya «@/db» por este
 * archivo. Producción nunca lo carga.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { getDb as getNeonDb } from "./index";
import * as schema from "./schema";

type DB = ReturnType<typeof getNeonDb>;

export const LOCAL_DIR = process.env.EASYATC_LOCAL_DIR || ".pglite";

// Una sola instancia por proceso, aunque Next recargue el módulo en caliente.
const g = globalThis as unknown as { __easyatcLocalDb?: DB };

export function getDb(): DB {
  if (!g.__easyatcLocalDb) {
    const db = drizzle(new PGlite(LOCAL_DIR), { schema });
    // neon-http agrupa consultas en db.batch(); aquí basta con ejecutarlas en orden.
    Object.assign(db, {
      batch: async (queries: PromiseLike<unknown>[]) => {
        const out = [];
        for (const q of queries) out.push(await q);
        return out;
      },
    });
    g.__easyatcLocalDb = db as unknown as DB;
  }
  return g.__easyatcLocalDb;
}

export { schema };
