// Se ejecuta en cada build de Vercel (script `vercel-build`): aplica las
// migraciones pendientes y crea DEMO01 si no existe. No toca ninguna sesión
// que ya exista (para recargar DEMO01 desde guion.json: npm run db:seed).
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
