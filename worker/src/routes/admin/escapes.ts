import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

import type { Env } from "../../types";

import { escapeLogs, participantEscapeMeta, programs } from "../../db/schema";
import { canAccessProgram, getAuth } from "../../lib/authz";

const app = new Hono<Env>();

// 관리자가 이탈 이벤트를 확인 완료로 처리 — 참여자의 누적 alertCount도 함께 초기화한다
// (다음에 다시 벗어나면 1단계부터 새로 카운트)
app.post("/:id/resolve", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const escapeRows = await db.select().from(escapeLogs).where(eq(escapeLogs.id, id));
  const escape = escapeRows[0];
  if (!escape) return c.json({ error: "이탈 기록을 찾을 수 없습니다." }, 404);

  const programRows = await db.select().from(programs).where(eq(programs.id, escape.programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
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

// 관제 화면이 폴링으로 새 단계(1/2/3단계)의 이탈을 발견해 팝업을 띄운 뒤, 그 시점의
// alertCount를 기록한다 — alertCount가 이보다 커지기(더 악화되기) 전까지는 같은 이탈로
// 팝업이 다시 뜨지 않는다 (해결 처리 전까지 유지, 새로고침해도 유지).
app.post("/:id/alerted", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const escapeRows = await db.select().from(escapeLogs).where(eq(escapeLogs.id, id));
  const escape = escapeRows[0];
  if (!escape) return c.json({ error: "이탈 기록을 찾을 수 없습니다." }, 404);

  const programRows = await db.select().from(programs).where(eq(programs.id, escape.programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const result = await db
    .update(escapeLogs)
    .set({ alertedAtCount: escape.alertCount })
    .where(eq(escapeLogs.id, id))
    .returning();

  return c.json(result[0]);
});

export default app;
