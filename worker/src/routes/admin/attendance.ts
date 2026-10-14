import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

import type { Env } from "../../types";

import { attendanceLogs, participantGroupOverrides, participants, programs } from "../../db/schema";
import { canAccessProgram, getAuth } from "../../lib/authz";
import { getKstNow } from "../../lib/kst";

const app = new Hono<Env>();

const loadAttendanceLogWithProgram = async (db: ReturnType<typeof drizzle>, logId: number) => {
  const logRows = await db.select().from(attendanceLogs).where(eq(attendanceLogs.id, logId));
  const log = logRows[0];
  if (!log) return null;

  const programRows = await db.select().from(programs).where(eq(programs.id, log.programId));
  const program = programRows[0];
  if (!program) return null;

  return { log, program };
};

const TIME_PATTERN = /^\d{2}:\d{2}$/;

// 휴대폰 미소지 등으로 참여자가 직접 출퇴근을 못 찍은 날, 관리자가 대신 근무 기록을
// 만든다. 위치 정보는 없으므로 전부 null로 남고, 강제수정(PUT)과 같은 방식으로 사유를
// note에 "[관리자등록]"으로 남기고 등록한 관리자/시각을 감사용으로 기록한다.
// 그날 기록이 이미 있으면(비활성화된 것 포함) 새로 만들지 않는다 — 그땐 수정/활성화로 처리.
app.post("/", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);

  const body = await c.req.json<{
    participantId?: number;
    workDate?: string; // "YYYY-MM-DD"
    clockIn?: string; // "HH:MM"
    clockOut?: string; // "HH:MM"
    status?: "NORMAL" | "LATE" | "EARLY_LEAVE";
    reason?: string;
  }>();

  if (!body.participantId || !body.workDate) {
    return c.json({ error: "참여자와 근무일을 지정해주세요." }, 400);
  }
  if (!body.clockIn || !TIME_PATTERN.test(body.clockIn)) {
    return c.json({ error: "출근시간을 입력해주세요." }, 400);
  }
  if (body.clockOut && !TIME_PATTERN.test(body.clockOut)) {
    return c.json({ error: "퇴근시간 형식이 올바르지 않습니다." }, 400);
  }
  if (body.clockOut && body.clockOut <= body.clockIn) {
    return c.json({ error: "퇴근시간은 출근시간보다 늦어야 합니다." }, 400);
  }
  if (!body.reason?.trim()) {
    return c.json({ error: "등록 사유(reason)는 필수입니다." }, 400);
  }
  if (body.workDate > getKstNow().date) {
    return c.json({ error: "오늘 이후 날짜의 근무는 등록할 수 없습니다." }, 400);
  }

  const participantRows = await db
    .select()
    .from(participants)
    .where(eq(participants.id, body.participantId));
  const participant = participantRows[0];
  if (!participant) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, participant.programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const [existingRows, groupOverrideRows] = await Promise.all([
    db
      .select({ id: attendanceLogs.id })
      .from(attendanceLogs)
      .where(
        and(
          eq(attendanceLogs.participantId, participant.id),
          eq(attendanceLogs.workDate, body.workDate),
        ),
      ),
    db
      .select({ groupId: participantGroupOverrides.groupId })
      .from(participantGroupOverrides)
      .where(
        and(
          eq(participantGroupOverrides.participantId, participant.id),
          eq(participantGroupOverrides.date, body.workDate),
        ),
      ),
  ]);
  if (existingRows.length > 0) {
    return c.json({ error: "이미 그날 근무 기록이 있습니다. 기존 기록을 수정해주세요." }, 409);
  }

  // 출근(clock-in)과 같은 규칙으로 그날 실제로 근무한 조를 기록한다 — 조 임시배정이 우선.
  const toIso = (time: string) => `${body.workDate}T${time}:00.000Z`;
  const clockIn = toIso(body.clockIn);
  const clockOut = body.clockOut ? toIso(body.clockOut) : null;

  const result = await db
    .insert(attendanceLogs)
    .values({
      participantId: participant.id,
      groupId: groupOverrideRows[0]?.groupId ?? participant.groupId,
      programId: participant.programId,
      workDate: body.workDate,
      clockIn,
      clockOut,
      totalMinutes: clockOut
        ? Math.floor((new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 60000)
        : null,
      status: body.status ?? "NORMAL",
      note: `[관리자등록] ${body.reason.trim()}`,
      correctedByAdminId: auth.id,
      correctedAt: new Date().toISOString(),
    })
    .returning();

  return c.json(result[0], 201);
});

// 사유는 프론트에도 보이는 note에 남기고, 누가/언제 고쳤는지는 correctedByAdminId/
// correctedAt에 감사 목적으로만 남긴다 (프론트에는 노출 안 함).
app.put("/:logId", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const logId = Number(c.req.param("logId"));

  const found = await loadAttendanceLogWithProgram(db, logId);
  if (!found) return c.json({ error: "출퇴근 기록을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const body = await c.req.json<{
    clockIn?: string; // "HH:MM"
    clockOut?: string; // "HH:MM"
    status?: "NORMAL" | "LATE" | "EARLY_LEAVE";
    reason?: string;
  }>();

  if (!body.reason) {
    return c.json({ error: "수정 사유(reason)는 필수입니다." }, 400);
  }

  const toIso = (time: string) => `${found.log.workDate}T${time}:00.000Z`;

  const finalClockIn = body.clockIn ? toIso(body.clockIn) : found.log.clockIn;
  const finalClockOut = body.clockOut ? toIso(body.clockOut) : found.log.clockOut;
  // 출근/퇴근 시간을 고치면 총 근무시간(분)도 항상 그 시간 기준으로 다시 계산한다 —
  // 관리자가 분 값을 직접 입력하게 두면 시간과 분이 어긋날 수 있다.
  const totalMinutes =
    finalClockIn && finalClockOut
      ? Math.floor((new Date(finalClockOut).getTime() - new Date(finalClockIn).getTime()) / 60000)
      : found.log.totalMinutes;

  const result = await db
    .update(attendanceLogs)
    .set({
      clockIn: finalClockIn,
      clockOut: finalClockOut,
      totalMinutes,
      status: body.status ?? found.log.status,
      // 이전 수정 사유를 지우지 않고 줄바꿈으로 이어붙인다 — 여러 번 수정하면 사유가
      // 계속 쌓여야 마지막 수정이 이전 수정 내역을 덮어쓰지 않는다.
      note: found.log.note
        ? `${found.log.note}\n[수동수정] ${body.reason}`
        : `[수동수정] ${body.reason}`,
      correctedByAdminId: auth.id,
      correctedAt: new Date().toISOString(),
    })
    .where(eq(attendanceLogs.id, logId))
    .returning();

  return c.json(result[0]);
});

app.post("/:logId/deactivate", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const logId = Number(c.req.param("logId"));

  const found = await loadAttendanceLogWithProgram(db, logId);
  if (!found) return c.json({ error: "출퇴근 기록을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }
  if (found.log.status === "INVALID") {
    return c.json({ error: "이미 비활성화된 기록입니다." }, 400);
  }

  const body = await c.req.json<{ reason?: string }>();

  const result = await db
    .update(attendanceLogs)
    .set({
      status: "INVALID",
      // 재활성화할 때 이 status로 되돌린다.
      previousStatus: found.log.status,
      note: found.log.note
        ? `${found.log.note}\n[비활성화] ${body.reason || "사유 미입력"}`
        : `[비활성화] ${body.reason || "사유 미입력"}`,
      correctedByAdminId: auth.id,
      correctedAt: new Date().toISOString(),
    })
    .where(eq(attendanceLogs.id, logId))
    .returning();

  return c.json(result[0]);
});

app.post("/:logId/activate", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const logId = Number(c.req.param("logId"));

  const found = await loadAttendanceLogWithProgram(db, logId);
  if (!found) return c.json({ error: "출퇴근 기록을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }
  if (found.log.status !== "INVALID") {
    return c.json({ error: "비활성화된 기록이 아닙니다." }, 400);
  }

  const result = await db
    .update(attendanceLogs)
    .set({
      status: found.log.previousStatus ?? "NORMAL",
      previousStatus: null,
      note: found.log.note ? `${found.log.note}\n[활성화]` : "[활성화]",
      correctedByAdminId: auth.id,
      correctedAt: new Date().toISOString(),
    })
    .where(eq(attendanceLogs.id, logId))
    .returning();

  return c.json(result[0]);
});

export default app;
