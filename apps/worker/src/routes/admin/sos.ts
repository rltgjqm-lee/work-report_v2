import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

import type { Env } from "../../types";

import { programs, sosEvents } from "../../db/schema";
import { canAccessProgram, getAuth } from "../../lib/authz";

const app = new Hono<Env>();

// 관리자가 SOS를 확인 완료로 처리
app.post("/:id/resolve", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const sosRows = await db.select().from(sosEvents).where(eq(sosEvents.id, id));
  const sos = sosRows[0];
  if (!sos) return c.json({ error: "SOS 기록을 찾을 수 없습니다." }, 404);

  const programRows = await db.select().from(programs).where(eq(programs.id, sos.programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const body = await c.req.json<{ memo?: string }>();

  const result = await db
    .update(sosEvents)
    .set({
      status: "RESOLVED",
      resolvedBy: auth.id,
      resolvedAt: new Date().toISOString(),
      memo: body.memo,
    })
    .where(eq(sosEvents.id, id))
    .returning();

  return c.json(result[0]);
});

// 관제 화면이 폴링으로 새 SOS를 발견해 팝업을 띄운 뒤 호출 — 확인 처리(resolve) 전까지는
// 같은 SOS로 팝업이 다시 뜨지 않는다(escapeLogs의 /alerted와 동일 패턴).
app.post("/:id/notified", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const sosRows = await db.select().from(sosEvents).where(eq(sosEvents.id, id));
  const sos = sosRows[0];
  if (!sos) return c.json({ error: "SOS 기록을 찾을 수 없습니다." }, 404);

  const programRows = await db.select().from(programs).where(eq(programs.id, sos.programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const result = await db
    .update(sosEvents)
    .set({ notifiedAt: new Date().toISOString() })
    .where(eq(sosEvents.id, id))
    .returning();

  return c.json(result[0]);
});

export default app;
