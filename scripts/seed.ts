import { getDb } from "../src/db";
import { createSession, deleteSessionByCode } from "../src/lib/seed";
import { runMigrations } from "./migrate";

try {
  process.loadEnvFile(".env.local");
} catch {}

async function main() {
  await runMigrations();
  console.log("Esquema al día.");

  const db = getDb();
  await deleteSessionByCode(db, "DEMO01");
  const code = await createSession(db, "Sesión de ejemplo", "DEMO01");
  console.log(`Sesión de ejemplo creada con código ${code}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
