import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

import { escapeLogs, programs, participantEscapeMeta } from "../db/schema";
import { canAccessProgram, getAuth } from "../lib/authz";
import type { Env } from "../types";

const app = new Hono<Env>();

// 관리자가 이탈 이벤트를 확인 완료로 처리 — 참여자의 누적 alertCount도 함께 초기화한다
// (다음에 다시 벗어나면 1단계부터 새로 카운트)
app.post("/:id/resolve", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const escapeRows = await db
    .select()
    .from(escapeLogs)
    .where(eq(escapeLogs.id, id));
  const escape = escapeRows[0];
  if (!escape) return c.json({ error: "Not found" }, 404);

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, escape.programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{ memo?: string }>();

  const result = await db
    .update(escapeLogs)
    .set({
      status: "RESOLVED",
      resolvedBy: auth.id,
      resolvedAt: new Date().toISOString(),
      memo: body.memo,
    })
    .where(eq(escapeLogs.id, id))
    .returning();

  await db
    .delete(participantEscapeMeta)
    .where(eq(participantEscapeMeta.participantId, escape.participantId));

  return c.json(result[0]);
});

export default app;
