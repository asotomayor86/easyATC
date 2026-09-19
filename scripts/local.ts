/**
 * npm run dev:local — prueba la app en local sin Neon ni conexión a la base de
 * producción.
 *
 * 1. Prepara una base Postgres local (PGlite, en la carpeta .pglite) y le
 *    aplica las migraciones.
 * 2. Si aún no existe, crea DEMO01 copiando el guion y las variables de la
 *    DEMO01 de producción (solo lectura; si no hay conexión, usa guion.json).
 * 3. Pone zonas.json como tablero en las sesiones que no tengan ninguno.
 * 4. Arranca `next dev` usando esa base.
 *
 * Nada de lo que se haga en local llega a producción. Para empezar de cero,
 * borra la carpeta .pglite.
 */
import { spawn } from "node:child_process";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { getDb, LOCAL_DIR } from "../src/db/local";
import { sessions } from "../src/db/schema";
import { parseMissionFile, toMissionFile } from "../src/lib/missionFile";
import { createSession, fillEmptyBoards } from "../src/lib/seed";

const PRODUCTION = "https://easy-atc.vercel.app/api/s/DEMO01";

async function copyOfProduction() {
  try {
    const res = await fetch(PRODUCTION, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    const parsed = parseMissionFile(toMissionFile(d.session, d.flights, d.steps));
    if (!parsed.ok) throw new Error(parsed.error);
    return parsed.mission;
  } catch (e) {
    console.warn(`No se pudo leer DEMO01 de producción (${(e as Error).message}); se usa guion.json.`);
    return undefined;
  }
}

async function main() {
  const db = getDb();
  // Mismo cliente PGlite que usa drizzle: el migrador de pglite lo necesita.
  await migrate(db as unknown as Parameters<typeof migrate>[0], { migrationsFolder: "./drizzle" });
  console.log(`Base local en ${LOCAL_DIR}: migraciones aplicadas.`);

  const [demo] = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.code, "DEMO01")).limit(1);
  if (demo) {
    console.log("DEMO01 local ya existe: se conserva (borra .pglite para empezar de cero).");
  } else {
    const mission = await copyOfProduction();
    await createSession(db, mission ? "DEMO01 (copia local)" : "Sesión de ejemplo", "DEMO01", mission);
    console.log(`DEMO01 local creada ${mission ? `con el guion de producción (${mission.steps.length} pasos)` : "desde guion.json"}.`);
  }
  const filled = await fillEmptyBoards(db);
  if (filled) console.log(`Tablero de zonas.json puesto en ${filled} sesión(es).`);

  // Cierra la base antes de que la abra el servidor.
  await (db as unknown as { $client: { close: () => Promise<void> } }).$client.close();

  console.log("\nArrancando en http://localhost:3000/s/DEMO01 …\n");
  const child = spawn("npx", ["next", "dev"], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, EASYATC_LOCAL: "1" },
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
