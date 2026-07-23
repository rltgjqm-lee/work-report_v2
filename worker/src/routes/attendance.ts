import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

import { attendanceLogs, programs } from "../db/schema";
import { canAccessProgram, getAuth } from "../lib/authz";
import type { Env } from "../types";

const app = new Hono<Env>();

const loadAttendanceLogWithProgram = async (
  db: ReturnType<typeof drizzle>,
  logId: number,
) => {
  const logRows = await db
    .select()
    .from(attendanceLogs)
    .where(eq(attendanceLogs.id, logId));
  const log = logRows[0];
  if (!log) return null;

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, log.programId));
  const program = programRows[0];
  if (!program) return null;

  return { log, program };
};

// 4-2 근태 강제 수정 — 출퇴근 시간(HH:MM)/상태/사유를 관리자가 직접 고친다.
// 사유는 감사 목적으로 note에 남긴다 (별도 감사로그 테이블은 아직 없음).
app.put("/:logId", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const logId = Number(c.req.param("logId"));

  const found = await loadAttendanceLogWithProgram(db, logId);
  if (!found) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{
    clockIn?: string; // "HH:MM"
    clockOut?: string; // "HH:MM"
    totalMinutes?: number;
    status?: "NORMAL" | "LATE" | "EARLY_LEAVE";
    reason?: string;
  }>();

  if (!body.reason) {
    return c.json({ error: "수정 사유(reason)는 필수입니다." }, 400);
  }

  const toIso = (time: string) => `${found.log.workDate}T${time}:00.000Z`;

  const result = await db
    .update(attendanceLogs)
    .set({
      clockIn: body.clockIn ? toIso(body.clockIn) : found.log.clockIn,
      clockOut: body.clockOut ? toIso(body.clockOut) : found.log.clockOut,
      totalMinutes: body.totalMinutes ?? found.log.totalMinutes,
      status: body.status ?? found.log.status,
      note: `[수동수정] ${body.reason}`,
    })
    .where(eq(attendanceLogs.id, logId))
    .returning();

  return c.json(result[0]);
});

// 4-2 근태 무효화 — 잘못된 기록을 삭제 대신 INVALID 처리(소프트 삭제)
app.post("/:logId/invalidate", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const logId = Number(c.req.param("logId"));

  const found = await loadAttendanceLogWithProgram(db, logId);
  if (!found) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "Forbidden" }, 403);
  }
  if (found.log.status === "INVALID") {
    return c.json({ error: "이미 무효화된 기록입니다." }, 400);
  }

  const body = await c.req.json<{ reason?: string }>();

  const result = await db
    .update(attendanceLogs)
    .set({
      status: "INVALID",
      note: `[무효화] ${body.reason || "사유 미입력"}`,
    })
    .where(eq(attendanceLogs.id, logId))
    .returning();

  return c.json(result[0]);
});

export default app;
