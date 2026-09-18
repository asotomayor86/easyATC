// Se ejecuta en cada build de Vercel (script `vercel-build`): aplica las
// migraciones pendientes y crea DEMO01 si aún no existe. No borra nada.
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
  const created = await ensureSession(getDb(), "DEMO01", "Sesión de ejemplo");
  console.log(created ? "Sesión DEMO01 creada." : "Sesión DEMO01 ya existía.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
