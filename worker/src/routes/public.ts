import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, isNull } from "drizzle-orm";

import {
  organizations,
  programs,
  pushSubscriptions,
  participants,
  attendanceLogs,
} from "../db/schema";
import { getKstNow } from "../lib/kst";
import type { Env } from "../types";

const app = new Hono<Env>();

app.get("/organizations", async (c) => {
  const db = drizzle(c.env.DB);
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      regionSido: organizations.regionSido,
      regionSigungu: organizations.regionSigungu,
      agencyType: organizations.agencyType,
    })
    .from(organizations);

  return c.json(rows);
});

app.get("/programs", async (c) => {
  const db = drizzle(c.env.DB);
  const organizationId = c.req.query("organizationId");

  const query = db
    .select({
      id: programs.id,
      name: programs.name,
      organizationId: programs.organizationId,
      startDate: programs.startDate,
      endDate: programs.endDate,
      startTime: programs.startTime,
      endTime: programs.endTime,
      projectType: programs.projectType,
    })
    .from(programs);

  const rows = organizationId
    ? await query.where(eq(programs.organizationId, Number(organizationId)))
    : await query;

  return c.json(rows);
});

app.post("/push-subscriptions", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{
    programId?: number;
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  }>();

  if (
    !body.programId ||
    !body.endpoint ||
    !body.keys?.p256dh ||
    !body.keys?.auth
  ) {
    return c.json(
      { error: "programId, endpoint, keys.p256dh, keys.auth are required" },
      400,
    );
  }

  const result = await db
    .insert(pushSubscriptions)
    .values({
      programId: body.programId,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        programId: body.programId,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
    })
    .returning();

  return c.json(result[0], 201);
});

// 참여자 셀프 근태체크 — 이름+전화번호 뒤4자리로 본인 확인 (등록 시 동명이인 구분에
// 쓰인 조합과 동일). 로그인/개인 UID 없이, 클라이언트가 응답의 participantId를
// 로컬스토리지에 저장해두고 이후 출퇴근에 재사용한다.
app.post("/attendance/identify", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{
    programId?: number;
    name?: string;
    phoneLast4?: string;
  }>();

  if (!body.programId || !body.name || !body.phoneLast4) {
    return c.json({ error: "programId, name, phoneLast4 are required" }, 400);
  }

  const rows = await db
    .select()
    .from(participants)
    .where(
      and(
        eq(participants.programId, body.programId),
        eq(participants.name, body.name),
        eq(participants.phoneLast4, body.phoneLast4),
      ),
    );

  const participant = rows[0];
  if (!participant) {
    return c.json({ error: "일치하는 참여자를 찾을 수 없습니다." }, 404);
  }

  return c.json({ participantId: participant.id, name: participant.name });
});

app.post("/attendance/clock-in", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{ participantId?: number }>();
  if (!body.participantId) {
    return c.json({ error: "participantId is required" }, 400);
  }

  const rows = await db
    .select()
    .from(participants)
    .where(eq(participants.id, body.participantId));
  const participant = rows[0];
  if (!participant) return c.json({ error: "Not found" }, 404);

  const { date, iso } = getKstNow();

  const existing = await db
    .select()
    .from(attendanceLogs)
    .where(
      and(
        eq(attendanceLogs.participantId, participant.id),
        eq(attendanceLogs.workDate, date),
      ),
    );
  if (existing.length > 0) {
    return c.json({ error: "이미 출근 처리되었습니다." }, 400);
  }

  const result = await db
    .insert(attendanceLogs)
    .values({
      participantId: participant.id,
      groupId: participant.groupId,
      programId: participant.programId,
      workDate: date,
      clockIn: iso,
    })
    .returning();

  return c.json(result[0], 201);
});

app.post("/attendance/clock-out", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{ participantId?: number }>();
  if (!body.participantId) {
    return c.json({ error: "participantId is required" }, 400);
  }

  const { date, iso } = getKstNow();

  const rows = await db
    .select()
    .from(attendanceLogs)
    .where(
      and(
        eq(attendanceLogs.participantId, body.participantId),
        eq(attendanceLogs.workDate, date),
        isNull(attendanceLogs.clockOut),
      ),
    );
  const log = rows[0];
  if (!log || !log.clockIn) {
    return c.json({ error: "출근 기록이 없습니다." }, 404);
  }

  const totalMinutes = Math.floor(
    (new Date(iso).getTime() - new Date(log.clockIn).getTime()) / 60000,
  );

  const result = await db
    .update(attendanceLogs)
    .set({ clockOut: iso, totalMinutes })
    .where(eq(attendanceLogs.id, log.id))
    .returning();

  return c.json(result[0]);
});

export default app;
