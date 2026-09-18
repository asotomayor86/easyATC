import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { marks, sessions } from "@/db/schema";
import { findSession, json, notFound } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { code } = await params;
  const session = await findSession(code);
  if (!session) return notFound();
  const db = getDb();
  await db.batch([
    db.delete(marks).where(eq(marks.sessionId, session.id)),
    db
      .update(sessions)
      .set({ resetAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(sessions.id, session.id)),
  ]);
  return json({ ok: true });
}
