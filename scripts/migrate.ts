import { migrate } from "drizzle-orm/neon-http/migrator";
import { getDb } from "../src/db";

try {
  process.loadEnvFile(".env.local");
} catch {}

export async function runMigrations() {
  await migrate(getDb(), { migrationsFolder: "./drizzle" });
}

if (require.main === module) {
  runMigrations()
    .then(() => console.log("Migraciones aplicadas."))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
