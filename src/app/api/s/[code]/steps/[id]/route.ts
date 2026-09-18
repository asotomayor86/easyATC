import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions, steps } from "@/db/schema";
import { UUID_RE, badRequest, findSession, json, notFound } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string; id: string }> };

const optional = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

/** Cuerpo: cualquiera de { pilotText, atcText, readbackText, checklist, counts }. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { code, id } = await params;
  if (!UUID_RE.test(id)) return json({ error: "Paso no encontrado" }, 404);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Cuerpo inválido");

  const patch: Partial<typeof steps.$inferInsert> = {};
  if ("pilotText" in body) patch.pilotText = optional(body.pilotText);
  if ("readbackText" in body) patch.readbackText = optional(body.readbackText);
  if ("atcText" in body) patch.atcText = String(body.atcText ?? "").trim();
  if ("checklist" in body) patch.checklist = String(body.checklist ?? "").trim();
  if ("counts" in body) patch.counts = body.counts !== false;
  if (Object.keys(patch).length === 0) return badRequest("Nada que guardar");

  const session = await findSession(code);
  if (!session) return notFound();
  const db = getDb();
  const [updated] = await db
    .update(steps)
    .set(patch)
    .where(and(eq(steps.id, id), eq(steps.sessionId, session.id)))
    .returning({ id: steps.id });
  if (!updated) return json({ error: "Paso no encontrado" }, 404);
  await db.update(sessions).set({ contentAt: sql`now()` }).where(eq(sessions.id, session.id));
  return json({ ok: true });
}

/** Quita la comunicación (y sus marcas). */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { code, id } = await params;
  if (!UUID_RE.test(id)) return json({ error: "Paso no encontrado" }, 404);
  const session = await findSession(code);
  if (!session) return notFound();
  const db = getDb();
  const [deleted] = await db
    .delete(steps)
    .where(and(eq(steps.id, id), eq(steps.sessionId, session.id)))
    .returning({ id: steps.id });
  if (!deleted) return json({ error: "Paso no encontrado" }, 404);
  await db.update(sessions).set({ contentAt: sql`now()` }).where(eq(sessions.id, session.id));
  return json({ ok: true });
}
