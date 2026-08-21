import { and, eq, inArray, isNull, like, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

import type { Env } from "../../types";

import {
  activityLogs,
  adminPushSubscriptions,
  admins,
  attendanceLogs,
  demandSiteLocations,
  demandSites,
  demandSiteSchedules,
  escapeLogs,
  groupMonthlySchedule,
  groups,
  organizations,
  participantEscapeMeta,
  participantGroupOverrides,
  participantMonthlySchedule,
  participants,
  programs,
  pushDeviceTokens,
  pushSubscriptions,
  sosEvents,
} from "../../db/schema";
import { canAccessProgram, parseIdArray } from "../../lib/authz";
import { readDebugOverride } from "../../lib/debugTime";
import { getFcmAccessToken, sendFcmPush } from "../../lib/fcmPush";
import {
  buildDemandSiteAreas,
  checkPositionAgainstDemandSite,
  distanceOutsideAreasM,
  distanceToNearestArea,
  isInsideArea,
} from "../../lib/geofence";
import { getKstNow } from "../../lib/kst";
import { sendWebPush } from "../../lib/webPush";

const app = new Hono<Env>();

// "HH:MM" -> 자정 기준 분
const toMinutes = (hhmm: string): number => {
  const [hour, minute] = hhmm.split(":").map(Number);
  return hour * 60 + minute;
};

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
      .from(programs)
      .where(eq(programs.isActive, true)),
  ]);

  return c.json({ organizations: organizationRows, programs: programRows });
});

app.get("/programs/:id/demand-sites", async (c) => {
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));

  const rows = await db
    .select({ id: demandSites.id, name: demandSites.name })
    .from(demandSites)
    .where(and(eq(demandSites.programId, programId), eq(demandSites.isActive, true)));

  return c.json(rows);
});

// 등록확인 화면에서 출근 식별(이름 확인)을 마친 뒤에만 호출되므로, 구독은 항상
// 참여자와 연결된 상태로 만들어진다 — 재난문자 대상 선정이 이 사람의 실제 근무
// 스케줄(조/월간스케줄/휴무)을 바로 판단할 수 있게 하기 위함.
app.post("/push-subscriptions", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{
    programId?: number;
    participantId?: number;
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  }>();

  if (
    !body.programId ||
    !body.participantId ||
    !body.endpoint ||
    !body.keys?.p256dh ||
    !body.keys?.auth
  ) {
    return c.json({ error: "푸시 구독 정보가 올바르지 않습니다." }, 400);
  }

  const result = await db
    .insert(pushSubscriptions)
    .values({
      programId: body.programId,
      participantId: body.participantId,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        programId: body.programId,
        participantId: body.participantId,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
    })
    .returning();

  return c.json(result[0], 201);
});

// 참여자 셀프 근무체크 — 이름으로 본인 확인 (동명이인은 등록 시 이름에 "1", "2"를
// 붙여 미리 구분해둔다). 로그인/개인 UID 없이, 클라이언트가 응답의 participantId를
// 로컬스토리지에 저장해두고 이후 출퇴근에 재사용한다.
// 💡 등록확인 화면이 참여자 상태(휴무/탈락)와 사업 기간을 바로 판단할 수 있도록,
// 이미 조회해둔 participant/program/organization row에서 필요한 필드를 한 응답에
// 같이 실어보낸다 — 화면이 그 판단을 위해 별도로 왕복할 필요가 없게 하기 위함이다.
app.post("/attendance/identify", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{
    programId?: number;
    name?: string;
  }>();

  if (!body.programId || !body.name) {
    return c.json({ error: "MISSING_FIELDS" }, 400);
  }

  const [programRows, participantRows] = await Promise.all([
    db.select().from(programs).where(eq(programs.id, body.programId)),
    db
      .select()
      .from(participants)
      .where(and(eq(participants.programId, body.programId), eq(participants.name, body.name))),
  ]);
  const program = programRows[0];
  const participant = participantRows[0];

  const organizationRows = program
    ? await db.select().from(organizations).where(eq(organizations.id, program.organizationId))
    : [];
  const organization = organizationRows[0];

  if (!participant) {
    // 메시지 문구는 프론트에서 조립한다 — 여기서는 판단에 필요한 코드/데이터만 내려준다.
    if (program) {
      return c.json(
        {
          error: "NOT_REGISTERED",
          organization: organization
            ? {
                regionSido: organization.regionSido,
                regionSigungu: organization.regionSigungu,
                name: organization.name,
              }
            : null,
          program: { name: program.name, programType: program.programType },
        },
        404,
      );
    }

    return c.json({ error: "PROGRAM_NOT_FOUND" }, 404);
  }

  return c.json({
    participantId: participant.id,
    name: participant.name,
    status: participant.status,
    leaveEnd: participant.leaveEnd,
    program: program ? { startDate: program.startDate, endDate: program.endDate } : null,
    organization: organization
      ? { regionSido: organization.regionSido, regionSigungu: organization.regionSigungu }
      : null,
  });
});

// 하이브리드 앱(Capacitor)이 발급받은 네이티브 푸시 토큰(FCM/APNs) 등록.
// 등록확인 화면에서 출근 식별(이름 확인)을 마친 뒤에만 호출되므로, push-subscriptions와
// 마찬가지로 토큰은 항상 참여자와 연결된 상태로 만들어진다.
app.post("/push-device-tokens", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{
    programId?: number;
    participantId?: number;
    platform?: "android" | "ios";
    token?: string;
  }>();

  if (!body.programId || !body.participantId || !body.platform || !body.token) {
    return c.json({ error: "사업단, 참여자, 플랫폼, 푸시 토큰을 모두 지정해주세요." }, 400);
  }

  const result = await db
    .insert(pushDeviceTokens)
    .values({
      programId: body.programId,
      participantId: body.participantId,
      platform: body.platform,
      token: body.token,
    })
    .onConflictDoUpdate({
      target: pushDeviceTokens.token,
      set: {
        programId: body.programId,
        participantId: body.participantId,
        platform: body.platform,
      },
    })
    .returning();

  return c.json(result[0], 201);
});

// 참여자용 앱의 홈 화면은 오늘 출퇴근 여부를 브라우저 로컬(IndexedDB) 캐시로만 판단하는데,
// 그 캐시가 없거나 다른 기기/새로고침으로 어긋나면 실제로는 출퇴근을 마쳤는데도 "출근 전"
// 으로 잘못 보일 수 있다. 그래서 오늘 실제 출퇴근 기록(진짜 소스인 attendance_logs)을
// 서버에서 다시 조회해 화면과 항상 맞출 수 있게 이 엔드포인트를 둔다.
app.get("/attendance/today", async (c) => {
  const db = drizzle(c.env.DB);
  const participantId = Number(c.req.query("participantId"));
  if (!participantId) {
    return c.json({ error: "참여자를 지정해주세요." }, 400);
  }

  // 💡 테스트 패널의 날짜/시간으로 출근을 등록했다면 "오늘 이미 출근했는지" 조회도
  // 같은 날짜 기준이어야 화면이 일관되게 맞는다 — clock-in/out과 동일하게 override를 받는다.
  const debugOverride = await readDebugOverride(c, {
    debugDate: c.req.query("debugDate"),
    debugTime: c.req.query("debugTime"),
  });
  const { date } = getKstNow(debugOverride.date, debugOverride.time);
  const yearMonth = date.slice(0, 7);

  const participantRows = await db
    .select()
    .from(participants)
    .where(eq(participants.id, participantId));
  const participant = participantRows[0];
  if (!participant) {
    return c.json({ error: "본인 확인이 만료되었습니다. 다시 확인해주세요." }, 404);
  }

  const [attendanceRows, groupOverrideRows, participantScheduleRows] = await Promise.all([
    db
      .select({ clockIn: attendanceLogs.clockIn, clockOut: attendanceLogs.clockOut })
      .from(attendanceLogs)
      .where(
        and(eq(attendanceLogs.participantId, participantId), eq(attendanceLogs.workDate, date)),
      ),
    // 오늘 날짜의 조 임시 배정이 있으면 원래 조 대신 이 조를 기준으로 근무일/근무시간을 본다
    // — clock-in의 effectiveGroupId 판정과 동일한 로직이어야 화면과 실제 출근 처리가 어긋나지 않는다.
    db
      .select()
      .from(participantGroupOverrides)
      .where(
        and(
          eq(participantGroupOverrides.participantId, participantId),
          eq(participantGroupOverrides.date, date),
        ),
      ),
    db
      .select()
      .from(participantMonthlySchedule)
      .where(
        and(
          eq(participantMonthlySchedule.participantId, participantId),
          eq(participantMonthlySchedule.yearMonth, yearMonth),
        ),
      ),
  ]);

  const attendanceRow = attendanceRows[0];
  const effectiveGroupId = groupOverrideRows[0]?.groupId ?? participant.groupId;

  let workDates = participantScheduleRows[0]
    ? (JSON.parse(participantScheduleRows[0].workDates) as string[])
    : null;
  let group: typeof groups.$inferSelect | undefined;

  if (effectiveGroupId) {
    const [groupScheduleRows, groupRows] = await Promise.all([
      workDates
        ? Promise.resolve([])
        : db
            .select()
            .from(groupMonthlySchedule)
            .where(
              and(
                eq(groupMonthlySchedule.groupId, effectiveGroupId),
                eq(groupMonthlySchedule.yearMonth, yearMonth),
              ),
            ),
      db.select().from(groups).where(eq(groups.id, effectiveGroupId)),
    ]);
    if (!workDates) {
      workDates = groupScheduleRows[0]
        ? (JSON.parse(groupScheduleRows[0].workDates) as string[])
        : null;
    }
    group = groupRows[0];
  }

  // 참여자/조 스케줄이 아예 없으면(스케줄 미편성 사업단) 근무일 여부를 판단할 근거가 없으니
  // 막지 않는다 — clock-in의 "workDates && !workDates.includes(date)" 판정과 동일 기준.
  const isWorkDay = !workDates || workDates.includes(date);

  return c.json({
    clockIn: attendanceRow?.clockIn ?? null,
    clockOut: attendanceRow?.clockOut ?? null,
    isWorkDay,
    shiftStart: group?.shiftStart ?? null,
    shiftEnd: group?.shiftEnd ?? null,
    locationConsentAt: participant.locationConsentAt ?? null,
  });
});

// 위치정보법상 위치 수집 전 고지·동의 기록 — 최초 출근 시 동의 화면을 거치면 호출된다.
// 이미 동의한 참여자가 다시 확인해도(설정 화면 등) 시각을 최신으로 갱신할 뿐 문제되지 않는다.
app.post("/attendance/location-consent", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{ participantId?: number }>();
  const participantId = Number(body.participantId);
  if (!participantId) {
    return c.json({ error: "참여자를 지정해주세요." }, 400);
  }

  const { iso: locationConsentAt } = getKstNow();

  await db
    .update(participants)
    .set({ locationConsentAt })
    .where(eq(participants.id, participantId));

  return c.json({ locationConsentAt });
});

// lat/lng는 필수다 — 없으면(위치 동의를 안 했거나 권한이 막혀 있으면) LOCATION_REQUIRED로
// 막는다. 좌표가 있는데 관제구역 밖으로 명확히 판정되면(position.inside === false)
// OUTSIDE_AREA로 막는다. 좌표는 있지만 그 수요처에 관제구역이 아직 등록 안 돼 있어
// 판정 자체가 안 되는 경우(position.inside === null)는 비교 대상이 없으니 막지 않는다.
app.post("/attendance/clock-in", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{
    participantId?: number;
    lat?: number;
    lng?: number;
    accuracy?: number;
    simulated?: boolean;
    debugDate?: string;
    debugTime?: string;
  }>();
  if (!body.participantId) {
    return c.json({ error: "참여자를 지정해주세요." }, 400);
  }

  const rows = await db.select().from(participants).where(eq(participants.id, body.participantId));
  let participant = rows[0];
  if (!participant) {
    return c.json({ error: "본인 확인이 만료되었습니다. 다시 확인해주세요." }, 404);
  }

  const debugOverride = await readDebugOverride(c, body);
  const { date, time, iso } = getKstNow(debugOverride.date, debugOverride.time);
  const yearMonth = date.slice(0, 7);

  // 서로 의존관계가 없는 조회 4개를 한 번에 실행해서 왕복 횟수를 줄인다 — 순차 실행 시
  // 출근 버튼을 누르고 나서 이 조회들의 지연시간이 그대로 누적됐다.
  const [groupOverrideRows, participantScheduleRows, existing, position] = await Promise.all([
    // 오늘 날짜의 조 임시 배정이 있으면 원래 조(participant.groupId) 대신 이 조를 기준으로
    // 근무일/근무시간을 판정한다 — 관리자가 특정 날짜에만 다른 조로 옮겨둔 경우.
    db
      .select()
      .from(participantGroupOverrides)
      .where(
        and(
          eq(participantGroupOverrides.participantId, participant.id),
          eq(participantGroupOverrides.date, date),
        ),
      ),
    db
      .select()
      .from(participantMonthlySchedule)
      .where(
        and(
          eq(participantMonthlySchedule.participantId, participant.id),
          eq(participantMonthlySchedule.yearMonth, yearMonth),
        ),
      ),
    db
      .select()
      .from(attendanceLogs)
      .where(
        and(eq(attendanceLogs.participantId, participant.id), eq(attendanceLogs.workDate, date)),
      ),
    checkPositionAgainstDemandSite(db, participant.demandSiteId, body.lat, body.lng),
  ]);

  const effectiveGroupId = groupOverrideRows[0]?.groupId ?? participant.groupId;

  // 조가 없으면 근무시간(shiftStart/shiftEnd) 기준이 없어서 아래 시간/스케줄 검증이 전부
  // 스킵된다 — 조 편성 전인 사업단을 위해 참여자 등록 자체는 허용하지만, 출근은 막는다.
  if (!effectiveGroupId) {
    return c.json(
      { error: "조가 배정되지 않아 출근할 수 없습니다. 관리자에게 문의해주세요." },
      400,
    );
  }

  // 휴무 종료일이 지났는데 스케줄러(returnFromLeave)가 아직 안 돌았으면 여기서도 복귀시킨다.
  if (participant.status === "ON_LEAVE" && participant.leaveEnd && participant.leaveEnd < date) {
    const updated = await db
      .update(participants)
      .set({ status: "ACTIVE", leaveStart: null, leaveEnd: null })
      .where(eq(participants.id, participant.id))
      .returning();
    participant = updated[0];
  }

  if (participant.status === "ON_LEAVE") {
    return c.json({ error: "휴가 중인 참여자는 출근할 수 없습니다." }, 400);
  }

  // 월간 근무 스케줄이 있으면 오늘이 근무일인지부터 확인한다 — 시간 검증보다 먼저다.
  // 참여자 개인 스케줄이 있으면 그걸 쓰고, 없으면 조 스케줄을 쓴다. 둘 다 이번 달
  // 레코드가 없으면(스케줄을 아직 안 만든 사업단) 이 검증은 건너뛴다.
  let workDates = participantScheduleRows[0]
    ? (JSON.parse(participantScheduleRows[0].workDates) as string[])
    : null;

  // effectiveGroupId가 있어야 하는 조회 3개(조 스케줄 대체, 조 근무시간, 수요처 배정 여부)도
  // 서로 독립적이라 한 번에 실행한다.
  let group: typeof groups.$inferSelect | undefined;
  if (effectiveGroupId) {
    const [groupScheduleRows, groupRows, demandSiteScheduleRows] = await Promise.all([
      workDates
        ? Promise.resolve([])
        : db
            .select()
            .from(groupMonthlySchedule)
            .where(
              and(
                eq(groupMonthlySchedule.groupId, effectiveGroupId),
                eq(groupMonthlySchedule.yearMonth, yearMonth),
              ),
            ),
      db.select().from(groups).where(eq(groups.id, effectiveGroupId)),
      participant.demandSiteId
        ? db
            .select()
            .from(demandSiteSchedules)
            .where(
              and(
                eq(demandSiteSchedules.demandSiteId, participant.demandSiteId),
                eq(demandSiteSchedules.groupId, effectiveGroupId),
              ),
            )
        : Promise.resolve([]),
    ]);
    if (!workDates) {
      workDates = groupScheduleRows[0]
        ? (JSON.parse(groupScheduleRows[0].workDates) as string[])
        : null;
    }
    group = groupRows[0];

    // 참여자의 수요처에 지금 조가 배정돼 있지 않으면 출근을 막는다 — 조 자체는
    // 배정돼 있어도(participants.groupId) 그 조가 이 수요처에서 근무하는 조가
    // 아닐 수 있다(관리자가 조를 바꾸면서 수요처 배정을 갱신하지 않은 경우 등).
    if (participant.demandSiteId && demandSiteScheduleRows.length === 0) {
      return c.json({ error: "수요처에 배정되지 않은 조입니다. 관리자에게 문의해주세요." }, 400);
    }
  }

  if (workDates && !workDates.includes(date)) {
    // 문구는 프론트에서 조립한다(전용 안내 모달을 보여줘야 해서) — 여기서는 코드만 내려준다.
    return c.json({ error: "NOT_WORK_DAY" }, 400);
  }

  // 배정된 조에 근무시간이 설정돼 있으면 근무 시작 15분 전부터, 종료 30분 후까지만 출근을
  // 허용한다. 조 미배정/근무시간 미설정 상태에서는 검증을 건너뛴다 (아직 조 편성을 안 한
  // 사업단도 있어서).
  let effectiveClockIn = iso;
  if (group) {
    const nowMinutes = toMinutes(time);
    const shiftStartMinutes = toMinutes(group.shiftStart);
    const earliest = shiftStartMinutes - 15;
    const latest = toMinutes(group.shiftEnd) + 30;

    if (nowMinutes < earliest) {
      // 문구는 프론트에서 조립한다(안내 모달에 시간표를 같이 보여줘야 해서) — 여기서는
      // 판단에 필요한 코드/데이터만 내려준다.
      return c.json(
        { error: "TOO_EARLY", now: time, shiftStart: group.shiftStart, shiftEnd: group.shiftEnd },
        400,
      );
    }
    if (nowMinutes > latest) {
      return c.json({ error: `이미 근무 종료 시간(${group.shiftEnd})이 지났습니다.` }, 400);
    }

    // 근무 시작 전(15분 여유 구간)에 눌렀으면 실제 시각이 아니라 정시로 기록한다 —
    // 일찍 왔다고 근무시간이 더 인정되면 안 된다(퇴근의 effectiveClockOut과 동일 취지).
    if (nowMinutes < shiftStartMinutes) {
      effectiveClockIn = `${date}T${group.shiftStart}:00.000Z`;
    }
  }

  if (existing.length > 0) {
    return c.json({ error: "이미 출근 처리되었습니다." }, 400);
  }

  // 위치 자체를 안 보냈으면(위치 동의를 안 했거나 브라우저/OS 권한이 막혀 있으면) 막는다 —
  // 관제구역 판정과 별개로 좌표 자체가 필수다. 프론트는 이 코드를 받으면 위치 동의
  // 모달을 다시 띄워 재시도할 수 있게 안내한다.
  if (body.lat === undefined || body.lat === null || body.lng === undefined || body.lng === null) {
    return c.json({ error: "LOCATION_REQUIRED" }, 400);
  }

  // position.inside가 false(명확히 구역 밖)일 때만 막는다 — null(관제구역이 아직 등록 안
  // 돼서 판정 불가)은 좌표는 있어도 비교 대상이 없는 경우라 막지 않는다.
  if (position.inside === false) {
    return c.json({ error: "OUTSIDE_AREA", distanceM: position.distanceM }, 400);
  }

  const result = await db
    .insert(attendanceLogs)
    .values({
      participantId: participant.id,
      groupId: effectiveGroupId,
      programId: participant.programId,
      workDate: date,
      clockIn: effectiveClockIn,
      clockInLat: body.lat ?? null,
      clockInLng: body.lng ?? null,
      clockInAccuracy: body.accuracy ?? null,
      clockInInside: position.inside,
      clockInDistanceM: position.distanceM,
      simulatedCount: body.simulated ? 1 : 0,
    })
    .returning();

  return c.json(result[0], 201);
});

app.post("/attendance/clock-out", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{
    participantId?: number;
    lat?: number;
    lng?: number;
    accuracy?: number;
    simulated?: boolean;
    debugDate?: string;
    debugTime?: string;
  }>();
  if (!body.participantId) {
    return c.json({ error: "참여자를 지정해주세요." }, 400);
  }

  const debugOverride = await readDebugOverride(c, body);
  const { date, time, iso } = getKstNow(debugOverride.date, debugOverride.time);

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

  const group = log.groupId
    ? (await db.select().from(groups).where(eq(groups.id, log.groupId)))[0]
    : undefined;

  // 배정된 조에 근무시간이 설정돼 있으면 종료시간 10분 전부터만 퇴근을 허용한다.
  // 그 전에는 아예 퇴근 등록을 막는다.
  // 문구는 프론트에서 조립한다(시간 부분을 강조해야 해서) — 여기서는 코드/데이터만 내려준다.
  const nowMinutes = toMinutes(time);
  if (group) {
    const earliest = toMinutes(group.shiftEnd) - 10;
    if (nowMinutes < earliest) {
      return c.json({ error: "TOO_EARLY_OUT", shiftEnd: group.shiftEnd }, 400);
    }
  }

  // 위 검증을 통과했다면(조가 있는 한) 종료시각 10분 전~종료시각 사이에 누른 것이다 —
  // 이 구간은 실제로 누른 시각이 아니라 조 근무종료시각으로 인정한다(자동퇴근과 동일 기준).
  // 종료시각을 지나서 누르면(야근 등) 실제 시각을 그대로 쓴다.
  const effectiveClockOut =
    group && nowMinutes < toMinutes(group.shiftEnd)
      ? `${log.workDate}T${group.shiftEnd}:00.000Z`
      : iso;

  const totalMinutes = Math.floor(
    (new Date(effectiveClockOut).getTime() - new Date(log.clockIn).getTime()) / 60000,
  );

  // 퇴근 위치도 출근과 같은 기준으로 기록만 한다. 좌표를 못 받았으면 배정 수요처를
  // 조회할 필요조차 없으니 D1 왕복을 건너뛴다.
  const hasCoordinates = body.lat !== undefined && body.lng !== undefined;
  const demandSiteRows = hasCoordinates
    ? await db
        .select({ demandSiteId: participants.demandSiteId })
        .from(participants)
        .where(eq(participants.id, log.participantId))
    : [];
  const position = await checkPositionAgainstDemandSite(
    db,
    demandSiteRows[0]?.demandSiteId ?? null,
    body.lat,
    body.lng,
  );

  const result = await db
    .update(attendanceLogs)
    .set({
      clockOut: effectiveClockOut,
      totalMinutes,
      status: "NORMAL",
      clockOutLat: body.lat ?? null,
      clockOutLng: body.lng ?? null,
      clockOutAccuracy: body.accuracy ?? null,
      clockOutInside: position.inside,
      clockOutDistanceM: position.distanceM,
      simulatedCount: log.simulatedCount + (body.simulated ? 1 : 0),
    })
    .where(eq(attendanceLogs.id, log.id))
    .returning();

  return c.json(result[0]);
});

// 역량활동 하루 근무 종료 후 참여자 서명 수집. base64를 거치지 않고 이미지 바이너리를
// 그대로 요청 body로 받아 R2에 저장한다 — attendance_logs에는 객체 키만 남긴다.
// (엑셀 출력 시 서버가 R2에서 읽어 base64로 되돌려준다: 그건 export 응답 JSON에만 필요)
app.post("/attendance/sign", async (c) => {
  const db = drizzle(c.env.DB);
  const participantId = Number(c.req.query("participantId"));
  if (!participantId) {
    return c.json({ error: "참여자를 지정해주세요." }, 400);
  }

  const contentType = c.req.header("Content-Type") || "image/png";
  const extension = contentType.split("/")[1]?.split(";")[0] || "png";
  const bytes = await c.req.arrayBuffer();
  if (bytes.byteLength === 0) {
    return c.json({ error: "서명 이미지가 비어있습니다." }, 400);
  }

  const { date } = getKstNow();

  const rows = await db
    .select()
    .from(attendanceLogs)
    .where(and(eq(attendanceLogs.participantId, participantId), eq(attendanceLogs.workDate, date)));
  const log = rows[0];
  if (!log) return c.json({ error: "근무 기록이 없습니다." }, 404);

  const key = `signatures/${log.programId}/${date.slice(0, 7)}/${log.participantId}/${log.id}.${extension}`;
  await c.env.SIGNATURES_BUCKET.put(key, bytes, {
    httpMetadata: { contentType },
  });

  const result = await db
    .update(attendanceLogs)
    .set({ signatureKey: key })
    .where(eq(attendanceLogs.id, log.id))
    .returning();

  return c.json(result[0]);
});

// 참여자 PWA(또는 향후 하이브리드 앱)가 출근 중일 때 주기적으로 위치를 보고하는 엔드포인트.
// 배정된 수요처 반경을 벗어났는지 판정하고, 새로 벗어난 경우에만 이탈 이벤트를 기록한다
// (반경 밖에 계속 있는 동안 매 호출마다 새로 기록하지 않음 — 벗어난 "사건" 단위로 집계).
app.post("/location", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{
    participantId?: number;
    lat?: number;
    lng?: number;
    accuracy?: number;
    simulated?: boolean;
  }>();

  if (!body.participantId || body.lat === undefined || body.lng === undefined) {
    return c.json({ error: "참여자와 위치 정보를 지정해주세요." }, 400);
  }

  const participantRows = await db
    .select()
    .from(participants)
    .where(eq(participants.id, body.participantId));
  const participant = participantRows[0];
  if (!participant) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);

  const { date, iso } = getKstNow();

  const openAttendance = await db
    .select()
    .from(attendanceLogs)
    .where(
      and(
        eq(attendanceLogs.participantId, participant.id),
        eq(attendanceLogs.workDate, date),
        isNull(attendanceLogs.clockOut),
      ),
    );
  if (openAttendance.length === 0) {
    return c.json({ ok: true, escaped: false, message: "출근 중이 아닙니다." });
  }

  // 좌표를 근무지로 위조하면 계속 "구역 안"으로만 찍혀서 이탈 기록이 아예 안 생긴다.
  // 그래서 조작 표시는 이탈 로그가 아니라 그 날 근무 기록에 누적해 드러나게 한다.
  if (body.simulated) {
    await db
      .update(attendanceLogs)
      .set({ simulatedCount: openAttendance[0].simulatedCount + 1 })
      .where(eq(attendanceLogs.id, openAttendance[0].id));
  }

  const metaRows = await db
    .select()
    .from(participantEscapeMeta)
    .where(eq(participantEscapeMeta.participantId, participant.id));
  const meta = metaRows[0];

  const saveMeta = (fields: { alertCount?: number; outsideStart?: string | null }) =>
    meta
      ? db
          .update(participantEscapeMeta)
          .set({
            ...fields,
            lastLat: body.lat,
            lastLng: body.lng,
            lastLocationAt: iso,
            // 새 위치가 들어왔으니 통신 끊김 상태는 해제
            signalLossAlertedAt: null,
            updatedAt: iso,
          })
          .where(eq(participantEscapeMeta.participantId, participant.id))
      : db.insert(participantEscapeMeta).values({
          participantId: participant.id,
          alertCount: fields.alertCount ?? 0,
          outsideStart: fields.outsideStart ?? null,
          lastLat: body.lat,
          lastLng: body.lng,
          lastLocationAt: iso,
        });

  if (!participant.demandSiteId) {
    await saveMeta({});
    return c.json({ ok: true, escaped: false, message: "수요처 미배정" });
  }

  const demandSiteRows = await db
    .select()
    .from(demandSites)
    .where(eq(demandSites.id, participant.demandSiteId));
  const demandSite = demandSiteRows[0];
  if (!demandSite) {
    await saveMeta({});
    return c.json({
      ok: true,
      escaped: false,
      message: "수요처 정보를 찾을 수 없습니다.",
    });
  }

  const locations = await db
    .select()
    .from(demandSiteLocations)
    .where(eq(demandSiteLocations.demandSiteId, demandSite.id));

  // 거점을 따로 안 그렸어도 수요처 자체에 기본 관제구역이 잡혀 있으면 그걸로 판정한다.
  const areas = buildDemandSiteAreas(demandSite, locations);

  if (areas.length === 0) {
    await saveMeta({});
    return c.json({
      ok: true,
      escaped: false,
      message: "등록된 관제구역이 없습니다.",
    });
  }

  const isInside = areas.some((area) => isInsideArea(body.lat!, body.lng!, area));
  const distanceKm = distanceToNearestArea(body.lat!, body.lng!, areas);
  const currentAlertCount = meta?.alertCount ?? 0;

  // GPS 오차보다 덜 벗어난 좌표로는 "구역 밖에 있다"고 단정할 수 없다. 실내 측위는
  // 오차가 수백 m~수 km까지 나오는데, 관제 반경이 최소 1.5km라서 그런 좌표를 그대로
  // 믿으면 실제로는 근무지에 있는 참여자에게 이탈 경고 푸시가 가고 관리자 화면에도
  // 허위 이탈이 쌓인다. 이럴 땐 판정을 보류하되 위치 수신 시각은 갱신해서
  // 통신 끊김(checkSignalLoss)으로 잘못 잡히지 않게 한다.
  const outsideMarginM = distanceOutsideAreasM(body.lat!, body.lng!, areas);
  const isTooInaccurateToJudge =
    !isInside && body.accuracy !== undefined && body.accuracy >= outsideMarginM;

  if (isTooInaccurateToJudge) {
    // 이미 이탈 중이었다면 그 상태를 끝내지 않고 그대로 둔다 — 오차가 큰 좌표 한 건이
    // 진행 중인 이탈을 "복귀"로 지워버리면 안 된다.
    await saveMeta({
      alertCount: currentAlertCount,
      outsideStart: meta?.outsideStart ?? null,
    });

    return c.json({
      ok: true,
      escaped: false,
      uncertain: true,
      distanceKm,
      accuracyM: body.accuracy,
      demandSiteName: demandSite.name,
      message: "위치 정확도가 낮아 이탈 판정을 보류했습니다.",
    });
  }

  if (!isInside) {
    const isNewEscape = !meta?.outsideStart;
    const newAlertCount = isNewEscape ? currentAlertCount + 1 : currentAlertCount;

    if (isNewEscape) {
      await db.insert(escapeLogs).values({
        participantId: participant.id,
        programId: participant.programId,
        demandSiteId: demandSite.id,
        detectedAt: iso,
        lat: body.lat,
        lng: body.lng,
        distanceKm,
        accuracyM: body.accuracy ?? null,
        alertCount: newAlertCount,
      });

      // 새 이탈이 시작될 때마다(1·2·3단계 이후 전부) 참여자 본인에게 푸시(웹+네이티브 앱).
      const escapePushPayload = {
        title: newAlertCount > 1 ? `⚠️ 이탈 경고 (${newAlertCount}회째)` : "⚠️ 이탈 경고",
        body: `${demandSite.name} 활동 구역을 벗어났습니다.`,
      };

      const subscriptions = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.participantId, participant.id));

      for (const subscription of subscriptions) {
        const result = await sendWebPush(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          escapePushPayload,
          {
            privateJWK: c.env.VAPID_PRIVATE_KEY,
            subject: c.env.VAPID_SUBJECT,
          },
        );
        if (!result.ok && result.expired) {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
        }
      }

      const deviceTokens = await db
        .select()
        .from(pushDeviceTokens)
        .where(eq(pushDeviceTokens.participantId, participant.id));

      if (deviceTokens.length > 0) {
        try {
          const fcmAuth = await getFcmAccessToken(c.env.FCM_SERVICE_ACCOUNT_KEY);
          for (const deviceToken of deviceTokens) {
            const result = await sendFcmPush(
              fcmAuth.projectId,
              fcmAuth.accessToken,
              deviceToken.token,
              escapePushPayload,
            );
            if (!result.ok && result.expired) {
              await db
                .delete(pushDeviceTokens)
                .where(eq(pushDeviceTokens.token, deviceToken.token));
            }
          }
        } catch (error) {
          console.error("이탈 경고 FCM 발송 실패:", error);
        }
      }
    }

    await saveMeta({
      alertCount: newAlertCount,
      outsideStart: meta?.outsideStart ?? iso,
    });

    return c.json({
      ok: true,
      escaped: true,
      distanceKm,
      alertCount: newAlertCount,
      demandSiteName: demandSite.name,
    });
  }

  // 반경 안으로 복귀 — alertCount는 유지하고(관리자가 RESOLVED해야 초기화) 진행 중이던 이탈만 종료
  await saveMeta({ alertCount: currentAlertCount, outsideStart: null });

  return c.json({
    ok: true,
    escaped: false,
    distanceKm,
    demandSiteName: demandSite.name,
  });
});

type ActivityLogBody = {
  participantId?: number;
  actDate?: string;
  startTime?: string;
  endTime?: string;
  content?: string;
  place?: string;
  hasAccident?: boolean;
  accidentChecked?: boolean;
  accidentDetail?: string;
  accidentAction?: string;
  userSignature?: string;
  demandSignature?: string;
};

// 업무일지(내용/장소)·안전일지(사고유무 확인)·참여자 서명은 필수값이다. 역량활동은 참여자
// 앱에서 업무/안전 모듈 자체를 보여주지 않으므로 그 두 항목은 요구하지 않는다(서명은 항상 필수).
const validateActivityLogRequiredSections = (
  body: ActivityLogBody,
  programType: string | null,
): string | null => {
  if (programType !== "역량 활동") {
    if (!body.content?.trim() || !body.place?.trim()) {
      return "업무 일지(활동내용/활동장소)를 입력해주세요.";
    }
    if (!body.accidentChecked) {
      return "안전 일지(사고 유무 확인)를 입력해주세요.";
    }
  }
  if (!body.userSignature?.trim()) {
    return "참여자 서명을 완료해주세요.";
  }
  return null;
};

// 활동일지 등록 — IndexedDB에 먼저 저장된 뒤(오프라인 대응) 온라인일 때 여기로 동기화된다.
// 참여자 식별은 /attendance/identify와 동일한 이름+전화번호 흐름에서 얻은 participantId를 그대로 쓴다.
app.post("/activity-logs", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<ActivityLogBody>();

  if (!body.participantId || !body.actDate || !body.startTime || !body.endTime) {
    return c.json({ error: "참여자, 활동일자, 시작 시간, 종료 시간을 모두 입력해주세요." }, 400);
  }

  const participantRows = await db
    .select({ programType: programs.programType })
    .from(participants)
    .innerJoin(programs, eq(participants.programId, programs.id))
    .where(eq(participants.id, body.participantId));
  if (!participantRows[0]) {
    return c.json({ error: "일치하는 참여자를 찾을 수 없습니다." }, 404);
  }

  const validationError = validateActivityLogRequiredSections(body, participantRows[0].programType);
  if (validationError) {
    return c.json({ error: validationError }, 400);
  }

  // 오프라인 큐가 서버 저장 성공 후 로컬에 serverId를 기록하기 전에 앱이 죽으면
  // 같은 참여자+날짜를 다시 신규 등록으로 재전송할 수 있다 — 그때 새 행 대신 기존
  // 행을 덮어써서(participant_id+act_date 유니크) 근무 기록/지급액이 중복되지 않게 한다.
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
      accidentChecked: body.accidentChecked ?? false,
      accidentDetail: body.accidentDetail,
      accidentAction: body.accidentAction,
      userSignature: body.userSignature,
      demandSignature: body.demandSignature,
    })
    .onConflictDoUpdate({
      target: [activityLogs.participantId, activityLogs.actDate],
      set: {
        startTime: body.startTime,
        endTime: body.endTime,
        content: body.content,
        place: body.place,
        hasAccident: body.hasAccident ?? false,
        accidentChecked: body.accidentChecked ?? false,
        accidentDetail: body.accidentDetail,
        accidentAction: body.accidentAction,
        userSignature: body.userSignature,
        demandSignature: body.demandSignature,
      },
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

  if (!body.participantId || !body.actDate || !body.startTime || !body.endTime) {
    return c.json({ error: "참여자, 활동일자, 시작 시간, 종료 시간을 모두 입력해주세요." }, 400);
  }

  const participantRows = await db
    .select({ programType: programs.programType })
    .from(participants)
    .innerJoin(programs, eq(participants.programId, programs.id))
    .where(eq(participants.id, body.participantId));
  if (!participantRows[0]) {
    return c.json({ error: "일치하는 참여자를 찾을 수 없습니다." }, 404);
  }

  const validationError = validateActivityLogRequiredSections(body, participantRows[0].programType);
  if (validationError) {
    return c.json({ error: validationError }, 400);
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
      accidentChecked: body.accidentChecked ?? false,
      accidentDetail: body.accidentDetail,
      accidentAction: body.accidentAction,
      userSignature: body.userSignature,
      demandSignature: body.demandSignature,
    })
    .where(and(eq(activityLogs.id, id), eq(activityLogs.participantId, body.participantId)))
    .returning();

  if (!result[0]) return c.json({ error: "활동일지를 찾을 수 없습니다." }, 404);
  return c.json(result[0]);
});

// 활동일지 조회 — 기기를 바꾸거나 IndexedDB가 지워졌을 때 복구용
app.get("/activity-logs", async (c) => {
  const db = drizzle(c.env.DB);
  const participantId = c.req.query("participantId");
  const month = c.req.query("month"); // "YYYY-MM"

  if (!participantId || !month) {
    return c.json({ error: "참여자와 조회할 월을 지정해주세요." }, 400);
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

// 화면 SOS 버튼(3초 카운트다운 뒤 자동 전송) — 참여자 본인 확인 이후 화면에서만 호출된다.
// 좌표는 그 순간 새로 측위하지 않고 participantEscapeMeta의 마지막 위치 보고를 그대로 쓴다
// (10분 주기라 실시간은 아니지만, 3초 카운트다운 안에 새 측위를 기다리게 하지 않기 위함).
app.post("/sos", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{ participantId?: number }>();
  if (!body.participantId) {
    return c.json({ error: "참여자를 지정해주세요." }, 400);
  }

  const participantRows = await db
    .select()
    .from(participants)
    .where(eq(participants.id, body.participantId));
  const participant = participantRows[0];
  if (!participant) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);

  const { date, iso } = getKstNow();

  const metaRows = await db
    .select()
    .from(participantEscapeMeta)
    .where(eq(participantEscapeMeta.participantId, participant.id));
  const meta = metaRows[0];

  // 관제 화면이 "이탈 중 SOS(최우선)"와 "구역 내 SOS"를 구분해 보여줄 수 있도록, 그 순간
  // 이탈 진행 중이었는지(outsideStart)를 스냅샷으로 남긴다.
  const escapeStatusAtTrigger: "OUTSIDE" | "INSIDE" | "UNKNOWN" = !meta
    ? "UNKNOWN"
    : meta.outsideStart
      ? "OUTSIDE"
      : "INSIDE";

  const result = await db
    .insert(sosEvents)
    .values({
      participantId: participant.id,
      programId: participant.programId,
      demandSiteId: participant.demandSiteId,
      triggeredAt: iso,
      lat: meta?.lastLat ?? null,
      lng: meta?.lastLng ?? null,
      escapeStatusAtTrigger,
    })
    .returning();

  // 같은 수요처에 배정되고 지금 근무 중인(퇴근 안 한) 동료들에게만 알린다 — 퇴근한 동료는
  // 알려도 도우러 올 수 없다. 이탈 경고 발송(/location)과 동일한 웹푸시/FCM 이중 채널.
  if (participant.demandSiteId) {
    const colleagueRows = await db
      .select({ participantId: participants.id })
      .from(participants)
      .innerJoin(
        attendanceLogs,
        and(
          eq(attendanceLogs.participantId, participants.id),
          eq(attendanceLogs.workDate, date),
          isNull(attendanceLogs.clockOut),
        ),
      )
      .where(
        and(
          eq(participants.demandSiteId, participant.demandSiteId),
          ne(participants.id, participant.id),
        ),
      );

    if (colleagueRows.length > 0) {
      const colleagueIds = colleagueRows.map((colleague) => colleague.participantId);
      const sosPushPayload = {
        title: "🚨 동료 SOS",
        body: `${participant.name}님이 도움을 요청했습니다. 확인해주세요.`,
      };

      const subscriptions = await db
        .select()
        .from(pushSubscriptions)
        .where(inArray(pushSubscriptions.participantId, colleagueIds));
      for (const subscription of subscriptions) {
        const pushResult = await sendWebPush(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          sosPushPayload,
          { privateJWK: c.env.VAPID_PRIVATE_KEY, subject: c.env.VAPID_SUBJECT },
        );
        if (!pushResult.ok && pushResult.expired) {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
        }
      }

      // FCM 액세스 토큰은 발급 비용이 있어 동료 수만큼 반복 발급하지 않고 한 번만 받아 재사용한다.
      const deviceTokens = await db
        .select()
        .from(pushDeviceTokens)
        .where(inArray(pushDeviceTokens.participantId, colleagueIds));
      if (deviceTokens.length > 0) {
        try {
          const fcmAuth = await getFcmAccessToken(c.env.FCM_SERVICE_ACCOUNT_KEY);
          for (const deviceToken of deviceTokens) {
            const pushResult = await sendFcmPush(
              fcmAuth.projectId,
              fcmAuth.accessToken,
              deviceToken.token,
              sosPushPayload,
            );
            if (!pushResult.ok && pushResult.expired) {
              await db
                .delete(pushDeviceTokens)
                .where(eq(pushDeviceTokens.token, deviceToken.token));
            }
          }
        } catch (error) {
          console.error("SOS 동료 알림 FCM 발송 실패:", error);
        }
      }
    }
  }

  // 이 사업단에 접근 권한 있는 관리자 전원(canAccessProgram과 동일 기준)에게 알린다.
  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, participant.programId));
  const program = programRows[0];
  if (program) {
    const activeAdminRows = await db.select().from(admins).where(eq(admins.isActive, true));
    const eligibleAdminIds = activeAdminRows
      .filter((admin) =>
        canAccessProgram(
          {
            id: admin.id,
            email: admin.email as string,
            name: admin.name,
            role: admin.role,
            organizationId: admin.organizationId,
            programIds: parseIdArray(admin.programIds),
            groupIds: parseIdArray(admin.groupIds),
            expiresAt: "",
          },
          program,
        ),
      )
      .map((admin) => admin.id);

    if (eligibleAdminIds.length > 0) {
      const adminSubscriptions = await db
        .select()
        .from(adminPushSubscriptions)
        .where(inArray(adminPushSubscriptions.adminId, eligibleAdminIds));

      // url은 알림을 클릭했을 때 관리자 콘솔이 열 경로 — 사업단과 참여자 이름을 같이
      // 실어 보내서, 안전 관제 화면이 그 사업단으로 바로 들어가면서 이름 검색까지
      // 채워진 상태로 뜨게 한다(EscapesPage의 programId/name 쿼리 파라미터).
      const adminPushPayload = {
        title: "🚨 SOS 발생",
        body: `${participant.name}님이 SOS를 요청했습니다. 관제 화면을 확인해주세요.`,
        url: `/admin/escapes?programId=${participant.programId}&name=${encodeURIComponent(participant.name)}`,
      };

      for (const subscription of adminSubscriptions) {
        const pushResult = await sendWebPush(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          adminPushPayload,
          { privateJWK: c.env.VAPID_PRIVATE_KEY, subject: c.env.VAPID_SUBJECT },
        );
        if (!pushResult.ok && pushResult.expired) {
          await db
            .delete(adminPushSubscriptions)
            .where(eq(adminPushSubscriptions.endpoint, subscription.endpoint));
        }
      }
    }
  }

  return c.json(result[0], 201);
});

export default app;
