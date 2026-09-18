import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions } from "@/db/schema";
import { json, notFound } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

/** Marca ahora como el momento en que se quita la pausa de la misión. */
export async function POST(_req: Request, { params }: Ctx) {
  const { code } = await params;
  const [row] = await getDb()
    .update(sessions)
    .set({ startedAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(sessions.code, code.toUpperCase()))
    .returning({ startedAt: sessions.startedAt });
  if (!row) return notFound();
  return json(row);
}
