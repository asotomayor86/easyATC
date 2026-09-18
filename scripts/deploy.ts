// Se ejecuta en cada build de Vercel (script `vercel-build`): aplica las
// migraciones pendientes y deja DEMO01 al día con guion.json: la crea si no
// existe y la vuelve a sembrar si cambia el número de pasos. Las demás
// sesiones no se tocan.
import { getDb } from "../src/db";
import { ensureSession } from "../src/lib/seed";
import { runMigrations } from "./migrate";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL no definida: se omiten migraciones.");
    return;
  }
  await runMigrations();
  console.log("Migraciones aplicadas.");
  const result = await ensureSession(getDb(), "DEMO01", "Sesión de ejemplo");
  console.log(`Sesión DEMO01: ${result}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
