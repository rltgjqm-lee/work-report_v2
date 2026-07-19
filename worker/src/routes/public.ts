import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, isNull, like } from "drizzle-orm";

import {
  organizations,
  programs,
  pushSubscriptions,
  participants,
  attendanceLogs,
  activityLogs,
} from "../db/schema";
import { getKstNow } from "../lib/kst";
import type { Env } from "../types";

const app = new Hono<Env>();

// 기관/사업단 목록을 한 번에 반환 — 기본 정보 입력 페이지의 지역/기관/사업단
// 캐스케이딩 드롭다운이 라운드트립 없이 한 번의 호출로 채워지도록 묶어서 내려준다.
app.get("/affiliations", async (c) => {
  const db = drizzle(c.env.DB);

  const [organizationRows, programRows] = await Promise.all([
    db
      .select({
        id: organizations.id,
        name: organizations.name,
        regionSido: organizations.regionSido,
        regionSigungu: organizations.regionSigungu,
        organizationType: organizations.organizationType,
      })
      .from(organizations)
      .where(eq(organizations.isActive, true)),
    db
      .select({
        id: programs.id,
        name: programs.name,
        organizationId: programs.organizationId,
        startDate: programs.startDate,
        endDate: programs.endDate,
        startTime: programs.startTime,
        endTime: programs.endTime,
        programType: programs.programType,
      })
      .from(programs),
  ]);

  return c.json({ organizations: organizationRows, programs: programRows });
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

type ActivityLogBody = {
  participantId?: number;
  actDate?: string;
  startTime?: string;
  endTime?: string;
  content?: string;
  place?: string;
  hasAccident?: boolean;
  accidentDetail?: string;
  accidentAction?: string;
  userSignature?: string;
  demandSignature?: string;
};

// 활동일지 등록 — IndexedDB에 먼저 저장된 뒤(오프라인 대응) 온라인일 때 여기로 동기화된다.
// 참여자 식별은 /attendance/identify와 동일한 이름+전화번호 흐름에서 얻은 participantId를 그대로 쓴다.
app.post("/activity-logs", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<ActivityLogBody>();

  if (
    !body.participantId ||
    !body.actDate ||
    !body.startTime ||
    !body.endTime
  ) {
    return c.json(
      { error: "participantId, actDate, startTime, endTime are required" },
      400,
    );
  }

  const participant = await db
    .select()
    .from(participants)
    .where(eq(participants.id, body.participantId));
  if (!participant[0]) {
    return c.json({ error: "일치하는 참여자를 찾을 수 없습니다." }, 404);
  }

  const result = await db
    .insert(activityLogs)
    .values({
      participantId: body.participantId,
      actDate: body.actDate,
      startTime: body.startTime,
      endTime: body.endTime,
      content: body.content,
      place: body.place,
      hasAccident: body.hasAccident ?? false,
      accidentDetail: body.accidentDetail,
      accidentAction: body.accidentAction,
      userSignature: body.userSignature,
      demandSignature: body.demandSignature,
    })
    .returning();

  return c.json(result[0], 201);
});

// 활동일지 수정 — 작성 도중(일시→내용→사고→서명) 단계마다 "저장하기"를 누르는 기존 흐름이라,
// 한 번 동기화된 뒤에도 이후 단계에서 채워진 내용이 서버에 반영되도록 등록과 별개로 둔다.
app.put("/activity-logs/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));
  const body = await c.req.json<ActivityLogBody>();

  if (
    !body.participantId ||
    !body.actDate ||
    !body.startTime ||
    !body.endTime
  ) {
    return c.json(
      { error: "participantId, actDate, startTime, endTime are required" },
      400,
    );
  }

  const result = await db
    .update(activityLogs)
    .set({
      actDate: body.actDate,
      startTime: body.startTime,
      endTime: body.endTime,
      content: body.content,
      place: body.place,
      hasAccident: body.hasAccident ?? false,
      accidentDetail: body.accidentDetail,
      accidentAction: body.accidentAction,
      userSignature: body.userSignature,
      demandSignature: body.demandSignature,
    })
    .where(
      and(
        eq(activityLogs.id, id),
        eq(activityLogs.participantId, body.participantId),
      ),
    )
    .returning();

  if (!result[0]) return c.json({ error: "Not found" }, 404);
  return c.json(result[0]);
});

// 활동일지 조회 — 기기를 바꾸거나 IndexedDB가 지워졌을 때 복구용
app.get("/activity-logs", async (c) => {
  const db = drizzle(c.env.DB);
  const participantId = c.req.query("participantId");
  const month = c.req.query("month"); // "YYYY-MM"

  if (!participantId || !month) {
    return c.json({ error: "participantId, month are required" }, 400);
  }

  const rows = await db
    .select()
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.participantId, Number(participantId)),
        like(activityLogs.actDate, `${month}%`),
      ),
    );

  return c.json(rows);
});

export default app;
