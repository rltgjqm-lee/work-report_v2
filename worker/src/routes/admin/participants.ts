import { and, desc, eq, gte, inArray, like, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

import { ROLES, type Env } from "../../types";

import {
  activityLogs,
  attendanceAttemptFailures,
  attendanceLogs,
  clientEvents,
  demandSites,
  escapeLogs,
  groups,
  groupShiftOverrides,
  organizations,
  participantAnnualLeave,
  participantGroupOverrides,
  participantLeaves,
  participantMonthlySchedule,
  participants,
  programs,
} from "../../db/schema";
import { canAccessProgram, getAuth } from "../../lib/authz";
import { matchEscapeToWorkDate } from "../../lib/escapeMatching";
import { getKstNow } from "../../lib/kst";
import { syncLeaveStatus } from "../../lib/leaveStatus";

export const toLeaveDays = (leaveStart: string, leaveEnd: string): number => {
  const start = new Date(`${leaveStart}T00:00:00Z`).getTime();
  const end = new Date(`${leaveEnd}T00:00:00Z`).getTime();
  return Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
};

const app = new Hono<Env>();

const loadParticipantWithProgram = async (
  db: ReturnType<typeof drizzle>,
  participantId: number,
) => {
  const participantRows = await db
    .select()
    .from(participants)
    .where(eq(participants.id, participantId));
  const participant = participantRows[0];
  if (!participant) return null;

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, participant.programId));
  const program = programRows[0];
  if (!program) return null;

  return { participant, program };
};

// 참여자 관리 화면(전체 사업단 통합 조회)용 — 사업단마다 상세를 반복 호출하지 않도록
// 참여자·사업단·기관을 한 번에 조인해서 내려준다.
app.get("/", async (c) => {
  const auth = getAuth(c);

  if (auth.role === ROLES.MANAGER && auth.programIds.length === 0) return c.json([]);

  const db = drizzle(c.env.DB);
  // demandName(자유 텍스트)이 비어있어도 demandSiteId로 실제 수요처가 배정된 참여자는
  // 있을 수 있어서(GET /programs/:id와 동일한 이유), 수요처명을 조인해 fallback으로 채운다.
  const baseQuery = db
    .select({
      id: participants.id,
      programId: participants.programId,
      name: participants.name,
      gender: participants.gender,
      demandName: participants.demandName,
      demandSiteName: demandSites.name,
      programName: programs.name,
      programType: programs.programType,
      organizationName: organizations.name,
    })
    .from(participants)
    .innerJoin(programs, eq(participants.programId, programs.id))
    .innerJoin(organizations, eq(programs.organizationId, organizations.id))
    .leftJoin(demandSites, eq(participants.demandSiteId, demandSites.id));

  const rows =
    auth.role === ROLES.SUPER_ADMIN
      ? await baseQuery
      : auth.role === ROLES.MANAGER
        ? await baseQuery.where(inArray(programs.id, auth.programIds))
        : await baseQuery.where(eq(programs.organizationId, auth.organizationId as number));

  return c.json(
    rows.map(({ demandSiteName, ...row }) => ({
      ...row,
      demandName: row.demandName ?? demandSiteName ?? null,
    })),
  );
});

// 참여자 상세 페이지 헤더 정보 — 소속 사업단/조/기관명까지 한 번에 내려준다
app.get("/:id", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const [groupRows, organizationRows] = await Promise.all([
    found.participant.groupId
      ? db.select().from(groups).where(eq(groups.id, found.participant.groupId))
      : Promise.resolve([]),
    db.select().from(organizations).where(eq(organizations.id, found.program.organizationId)),
  ]);

  return c.json({
    ...found.participant,
    programName: found.program.name,
    programType: found.program.programType,
    programHourlyWage: found.program.hourlyWage,
    groupName: groupRows[0]?.name ?? null,
    organizationName: organizationRows[0]?.name ?? null,
  });
});

// 최근 30일 앱 오류 기록 — 폰에서 서버에 닿지 못해 나중에 보고된 실패(client_events)와
// 서버에 닿았지만 거부된 출퇴근 실패(attendance_attempt_failures)를 한 목록으로 내려준다.
// "폰에서는 했다는데 서버엔 없다"는 문의가 왔을 때 원인을 관리자가 직접 확인하는 용도다.
app.get("/:id/app-errors", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const { iso } = getKstNow();
  const since = new Date(Date.parse(iso) - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [appRows, serverRows] = await Promise.all([
    db
      .select()
      .from(clientEvents)
      .where(and(eq(clientEvents.participantId, id), gte(clientEvents.workDate, since))),
    db
      .select()
      .from(attendanceAttemptFailures)
      .where(
        and(
          eq(attendanceAttemptFailures.participantId, id),
          gte(attendanceAttemptFailures.workDate, since),
        ),
      ),
  ]);

  const rows = [
    ...appRows.map((row) => ({
      key: `app-${row.id}`,
      reachedServer: false,
      kind: row.kind,
      workDate: row.workDate,
      occurredAt: row.lastOccurredAt,
      occurrences: row.occurrences,
      message: row.message,
      httpStatus: row.httpStatus,
      online: row.online,
      connectionType: row.connectionType,
      platform: row.platform,
      appVersion: row.appVersion,
      bundleVersion: row.bundleVersion,
    })),
    ...serverRows.map((row) => ({
      key: `server-${row.id}`,
      reachedServer: true,
      kind: row.kind,
      workDate: row.workDate,
      occurredAt: row.attemptedAt,
      occurrences: 1,
      message: row.locationFailure ? `${row.error} (위치: ${row.locationFailure})` : row.error,
      httpStatus: row.httpStatus,
      online: null,
      connectionType: null,
      platform: row.platform,
      appVersion: null,
      bundleVersion: null,
    })),
  ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  return c.json(rows);
});

// 참여자 개인 근무 이력 — 관리자 콘솔 참여자 상세 페이지에서 쓴다
app.get("/:id/attendance", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const month = c.req.query("month");
  if (!month) return c.json({ error: "조회할 월을 지정해주세요." }, 400);

  const rows = await db
    .select({
      log: attendanceLogs,
      groupName: groups.name,
      // 지각/조퇴 판정 기준이 되는 시간표라 조 기본값이 아니라 그날의 근무시간이어야 한다
      // — 날짜별 근무시간(group_shift_overrides)이 걸린 날은 그 값을 쓴다. 목록을 SQL
      // 한 방으로 뽑느라 resolveGroupShift(lib/scheduling.ts)를 못 써서 COALESCE로 같은
      // 우선순위를 재현한다.
      shiftStart: sql<
        string | null
      >`COALESCE(${groupShiftOverrides.shiftStart}, ${groups.shiftStart})`,
      shiftEnd: sql<string | null>`COALESCE(${groupShiftOverrides.shiftEnd}, ${groups.shiftEnd})`,
      activityLogId: activityLogs.id,
      hasAccident: activityLogs.hasAccident,
      accidentChecked: activityLogs.accidentChecked,
      accidentDetail: activityLogs.accidentDetail,
      accidentAction: activityLogs.accidentAction,
      userSignature: activityLogs.userSignature,
    })
    .from(attendanceLogs)
    .leftJoin(groups, eq(attendanceLogs.groupId, groups.id))
    .leftJoin(
      groupShiftOverrides,
      and(
        eq(groupShiftOverrides.groupId, attendanceLogs.groupId),
        eq(groupShiftOverrides.date, attendanceLogs.workDate),
      ),
    )
    // 같은 참여자+날짜의 활동일지(업무/안전/서명)를 붙여 미완료 여부를 같이 내려준다.
    .leftJoin(
      activityLogs,
      and(
        eq(activityLogs.participantId, attendanceLogs.participantId),
        eq(activityLogs.actDate, attendanceLogs.workDate),
      ),
    )
    .where(and(eq(attendanceLogs.participantId, id), like(attendanceLogs.workDate, `${month}%`)))
    .orderBy(desc(attendanceLogs.workDate));

  // 참여자가 같은 날짜에 활동일지를 중복 제출하면(오프라인 재동기화 등) 위 조인이 근무
  // 기록 하나를 여러 번 복제해서 내려보낸다 — 근무 기록 id당 가장 최근 활동일지 하나만 남긴다.
  const dedupedRows = [
    ...rows
      .reduce((byLogId, row) => {
        const existing = byLogId.get(row.log.id);
        if (!existing || (row.activityLogId ?? -1) > (existing.activityLogId ?? -1)) {
          byLogId.set(row.log.id, row);
        }

        return byLogId;
      }, new Map<number, (typeof rows)[number]>())
      .values(),
  ];

  const stats = {
    total: dedupedRows.length,
    normal: dedupedRows.filter((row) => row.log.status === "NORMAL").length,
    late: dedupedRows.filter((row) => row.log.status === "LATE").length,
    earlyLeave: dedupedRows.filter((row) => row.log.status === "EARLY_LEAVE").length,
    totalHours: Math.floor(
      dedupedRows.reduce((sum, row) => sum + (row.log.totalMinutes ?? 0), 0) / 60,
    ),
  };

  // 위치 열 옆에 안전관제(EscapesPage)에서 이미 처리한 이탈 상태/메모를 같이 보여준다 —
  // detectedAt이 이 월 안이면 workDate도 반드시 같은 월이라 이 범위로 좁혀도 매칭 결과는
  // 전체 조회와 같다.
  const escapeRows = await db
    .select({
      participantId: escapeLogs.participantId,
      detectedAt: escapeLogs.detectedAt,
      status: escapeLogs.status,
      memo: escapeLogs.memo,
    })
    .from(escapeLogs)
    .where(and(eq(escapeLogs.participantId, id), like(escapeLogs.detectedAt, `${month}%`)));

  // 원본 서명 텍스트(base64)는 목록 응답에 실을 필요가 없어 있는지 여부만 boolean으로 내려준다.
  const logs = dedupedRows.map((row) => {
    const matchedEscape = matchEscapeToWorkDate(escapeRows, id, row.log.workDate);

    return {
      log: row.log,
      groupName: row.groupName,
      shiftStart: row.shiftStart,
      shiftEnd: row.shiftEnd,
      activity: {
        hasAccident: row.hasAccident ?? false,
        accidentChecked: row.accidentChecked ?? false,
        accidentDetail: row.accidentDetail ?? null,
        accidentAction: row.accidentAction ?? null,
        signed: !!row.userSignature,
      },
      escapeStatus: matchedEscape?.status ?? null,
      escapeMemo: matchedEscape?.memo ?? null,
    };
  });

  return c.json({ logs, stats });
});

// 참여자 상세 페이지의 "휴가 이력" 섹션용 — 실제 휴가 신청 기록 전체(연도 무관)와, 그
// 화면이 같이 보여주는 연차 현황(그 해 총 부여일/사용/잔여)을 한 번에 내려준다.
app.get("/:id/leaves", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const year = c.req.query("year") ?? getKstNow().date.slice(0, 4);

  const [leaveRows, annualLeaveRows] = await Promise.all([
    db
      .select()
      .from(participantLeaves)
      .where(eq(participantLeaves.participantId, id))
      .orderBy(desc(participantLeaves.leaveStart)),
    db
      .select()
      .from(participantAnnualLeave)
      .where(
        and(eq(participantAnnualLeave.participantId, id), eq(participantAnnualLeave.year, year)),
      ),
  ]);

  return c.json({
    leaves: leaveRows,
    annualLeave: annualLeaveRows[0] ?? {
      participantId: id,
      year,
      totalDays: 0,
      usedDays: 0,
      remainingDays: 0,
    },
  });
});

app.put("/:id", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const body = await c.req.json<{
    name?: string;
    demandName?: string;
    demandSiteId?: number;
    birthYear?: number;
    groupId?: number;
    hourlyWage?: number | null;
    educationAmount?: number;
    educationType?: "add" | "deduct" | "none";
    dementiaAmount?: number;
    dementiaType?: "add" | "deduct" | "none";
    healthInsuranceEnrolled?: boolean;
    longtermCareInsuranceEnrolled?: boolean;
    employmentInsuranceEnrolled?: boolean;
    industrialAccidentInsuranceEnrolled?: boolean;
    weeklyHolidayHours?: number;
  }>();

  if (body.demandSiteId) {
    const demandSiteRows = await db
      .select()
      .from(demandSites)
      .where(eq(demandSites.id, body.demandSiteId));
    if (demandSiteRows[0]?.programId !== found.participant.programId) {
      return c.json({ error: "해당 사업단의 수요처가 아닙니다." }, 400);
    }
  }

  const result = await db.update(participants).set(body).where(eq(participants.id, id)).returning();

  return c.json(result[0]);
});

// 개별 참여자 조 이동
app.post("/:id/group", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const body = await c.req.json<{ groupId?: number }>();
  if (!body.groupId) return c.json({ error: "조를 지정해주세요." }, 400);

  const groupRows = await db.select().from(groups).where(eq(groups.id, body.groupId));
  const group = groupRows[0];
  if (!group || group.programId !== found.participant.programId) {
    return c.json({ error: "해당 사업단의 조가 아닙니다." }, 400);
  }

  const result = await db
    .update(participants)
    .set({ groupId: body.groupId })
    .where(eq(participants.id, id))
    .returning();

  return c.json(result[0]);
});

// 개별 참여자 수요처 배정/변경
app.post("/:id/demand-site", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const body = await c.req.json<{ demandSiteId?: number }>();
  if (!body.demandSiteId) return c.json({ error: "수요처를 지정해주세요." }, 400);

  const demandSiteRows = await db
    .select()
    .from(demandSites)
    .where(eq(demandSites.id, body.demandSiteId));
  const demandSite = demandSiteRows[0];
  if (!demandSite || demandSite.programId !== found.participant.programId) {
    return c.json({ error: "해당 사업단의 수요처가 아닙니다." }, 400);
  }

  const result = await db
    .update(participants)
    // demandName(자유 텍스트)이 남아있으면 join으로 채운 수요처명을 가려버리므로 같이 비운다.
    .set({ demandSiteId: body.demandSiteId, demandName: null })
    .where(eq(participants.id, id))
    .returning();

  return c.json(result[0]);
});

// 특정 날짜만 다른 조로 취급하는 임시 배정 이력 — 원래 조(participants.groupId)는 그대로 두고
// 그날의 출퇴근 시간/근무일 판정에서만 이 조를 우선 적용한다 (worker/src/routes/public.ts 참고)
app.get("/:id/group-overrides", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const rows = await db
    .select({ override: participantGroupOverrides, groupName: groups.name })
    .from(participantGroupOverrides)
    .innerJoin(groups, eq(participantGroupOverrides.groupId, groups.id))
    .where(eq(participantGroupOverrides.participantId, id))
    .orderBy(desc(participantGroupOverrides.date));

  return c.json(rows);
});

app.post("/:id/group-overrides", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const body = await c.req.json<{ date?: string; groupId?: number }>();
  if (!body.date || !body.groupId) {
    return c.json({ error: "날짜와 조를 지정해주세요." }, 400);
  }

  const groupRows = await db.select().from(groups).where(eq(groups.id, body.groupId));
  const group = groupRows[0];
  if (!group || group.programId !== found.participant.programId) {
    return c.json({ error: "해당 사업단의 조가 아닙니다." }, 400);
  }

  const existingRows = await db
    .select()
    .from(participantGroupOverrides)
    .where(
      and(
        eq(participantGroupOverrides.participantId, id),
        eq(participantGroupOverrides.date, body.date),
      ),
    );
  const existing = existingRows[0];

  if (existing) {
    const result = await db
      .update(participantGroupOverrides)
      .set({ groupId: body.groupId, createdBy: auth.id })
      .where(eq(participantGroupOverrides.id, existing.id))
      .returning();
    return c.json(result[0]);
  }

  const result = await db
    .insert(participantGroupOverrides)
    .values({
      participantId: id,
      date: body.date,
      groupId: body.groupId,
      createdBy: auth.id,
    })
    .returning();

  return c.json(result[0], 201);
});

app.delete("/:id/group-overrides/:date", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));
  const date = c.req.param("date");

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  await db
    .delete(participantGroupOverrides)
    .where(
      and(
        eq(participantGroupOverrides.participantId, id),
        eq(participantGroupOverrides.date, date),
      ),
    );

  return c.json({ success: true });
});

app.post("/:id/drop", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const body = await c.req.json<{ dropReason?: string }>();

  const result = await db
    .update(participants)
    .set({
      status: "DROPPED",
      droppedAt: new Date().toISOString(),
      dropReason: body.dropReason,
    })
    .where(eq(participants.id, id))
    .returning();

  return c.json(result[0]);
});

app.post("/:id/leave", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const body = await c.req.json<{
    leaveStart?: string;
    leaveEnd?: string;
    leaveType?: "PAID" | "UNPAID";
    reason?: string;
  }>();

  if (!body.leaveStart || !body.leaveEnd) {
    return c.json({ error: "휴직 시작일과 종료일을 입력해주세요." }, 400);
  }

  const leaveType = body.leaveType ?? "PAID";
  const leaveDays = toLeaveDays(body.leaveStart, body.leaveEnd);
  // 등록한 날이 아니라 휴무 날짜의 연도 연차에서 뺀다 — 지난해 날짜를 소급 등록하거나
  // 연말에 다음 해 휴무를 미리 넣을 때 엉뚱한 해의 연차가 빠지지 않게.
  const year = body.leaveStart.slice(0, 4);

  if (leaveType === "PAID") {
    const annualRows = await db
      .select()
      .from(participantAnnualLeave)
      .where(
        and(eq(participantAnnualLeave.participantId, id), eq(participantAnnualLeave.year, year)),
      );
    const remainingDays = annualRows[0]?.remainingDays ?? 0;
    if (remainingDays < leaveDays) {
      return c.json(
        {
          error: `잔여 연차가 부족합니다. (잔여 ${remainingDays}일, 신청 ${leaveDays}일)`,
        },
        400,
      );
    }
  }

  await db.insert(participantLeaves).values({
    participantId: id,
    leaveStart: body.leaveStart,
    leaveEnd: body.leaveEnd,
    leaveType,
    leaveDays,
    reason: body.reason,
    createdBy: auth.id,
  });

  if (leaveType === "PAID") {
    await db
      .update(participantAnnualLeave)
      .set({
        usedDays: sql`${participantAnnualLeave.usedDays} + ${leaveDays}`,
        remainingDays: sql`${participantAnnualLeave.remainingDays} - ${leaveDays}`,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(eq(participantAnnualLeave.participantId, id), eq(participantAnnualLeave.year, year)),
      );
  }

  // 휴무 중 상태는 등록 시점이 아니라 휴무 기간 기준이다 — 시작일이 미래면 ACTIVE 그대로다.
  await syncLeaveStatus(db, getKstNow().date, { participantId: id });
  const result = await db.select().from(participants).where(eq(participants.id, id));

  return c.json(result[0]);
});

app.post("/:id/leave/end", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  // 휴무 중 상태는 휴무 이력 기간으로 다시 맞춰지므로(syncLeaveStatus), 상태만 ACTIVE로
  // 바꾸면 다음 동기화 때 도로 ON_LEAVE가 된다 — 오늘이 걸린 휴무를 어제까지로 줄이고,
  // 오늘 시작한 휴무면 아예 지운다. 줄어든 일수만큼 유급휴무의 연차 차감도 되돌린다.
  const { date: today } = getKstNow();
  const yesterdayDate = new Date(`${today}T00:00:00Z`);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);

  const coveringLeaves = await db
    .select()
    .from(participantLeaves)
    .where(
      and(
        eq(participantLeaves.participantId, id),
        lte(participantLeaves.leaveStart, today),
        gte(participantLeaves.leaveEnd, today),
      ),
    );

  for (const leave of coveringLeaves) {
    const remainingLeaveDays =
      leave.leaveStart <= yesterday ? toLeaveDays(leave.leaveStart, yesterday) : 0;
    if (remainingLeaveDays === 0) {
      await db.delete(participantLeaves).where(eq(participantLeaves.id, leave.id));
    } else {
      await db
        .update(participantLeaves)
        .set({ leaveEnd: yesterday, leaveDays: remainingLeaveDays })
        .where(eq(participantLeaves.id, leave.id));
    }

    const refundDays = leave.leaveDays - remainingLeaveDays;
    if (leave.leaveType === "PAID" && refundDays > 0) {
      // 등록할 때와 같은 기준(휴무 시작일의 연도)으로 차감했던 연차를 돌려준다
      await db
        .update(participantAnnualLeave)
        .set({
          usedDays: sql`${participantAnnualLeave.usedDays} - ${refundDays}`,
          remainingDays: sql`${participantAnnualLeave.remainingDays} + ${refundDays}`,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(participantAnnualLeave.participantId, id),
            eq(participantAnnualLeave.year, leave.leaveStart.slice(0, 4)),
          ),
        );
    }
  }

  await syncLeaveStatus(db, today, { participantId: id });
  const result = await db.select().from(participants).where(eq(participants.id, id));

  return c.json(result[0]);
});

// 탈락 처리된 참여자를 다시 ACTIVE로 되돌린다
app.post("/:id/reactivate", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }
  if (found.participant.status !== "DROPPED") {
    return c.json({ error: "탈락 상태인 참여자만 재활성화할 수 있습니다." }, 400);
  }

  const result = await db
    .update(participants)
    .set({
      status: "ACTIVE",
      droppedAt: null,
      dropReason: null,
    })
    .where(eq(participants.id, id))
    .returning();

  return c.json(result[0]);
});

app.get("/:id/annual-leave", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const year = c.req.query("year") ?? getKstNow().date.slice(0, 4);

  const rows = await db
    .select()
    .from(participantAnnualLeave)
    .where(
      and(eq(participantAnnualLeave.participantId, id), eq(participantAnnualLeave.year, year)),
    );

  return c.json(
    rows[0] ?? {
      participantId: id,
      year,
      totalDays: 0,
      usedDays: 0,
      remainingDays: 0,
    },
  );
});

app.post("/:id/annual-leave", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const body = await c.req.json<{ year?: string; totalDays?: number }>();
  if (!body.year || body.totalDays === undefined) {
    return c.json({ error: "연도와 총 일수를 입력해주세요." }, 400);
  }

  const existingRows = await db
    .select()
    .from(participantAnnualLeave)
    .where(
      and(eq(participantAnnualLeave.participantId, id), eq(participantAnnualLeave.year, body.year)),
    );
  const existing = existingRows[0];

  if (existing) {
    const result = await db
      .update(participantAnnualLeave)
      .set({
        totalDays: body.totalDays,
        remainingDays: body.totalDays - existing.usedDays,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(participantAnnualLeave.id, existing.id))
      .returning();
    return c.json(result[0]);
  }

  const result = await db
    .insert(participantAnnualLeave)
    .values({
      participantId: id,
      year: body.year,
      totalDays: body.totalDays,
      usedDays: 0,
      remainingDays: body.totalDays,
    })
    .returning();

  return c.json(result[0], 201);
});

// 참여자 개인 예외 스케줄 조회 — 레코드가 없으면 조 스케줄을 그대로 따른다는 뜻으로
// workDates: null을 내려준다 (조 기본값은 groups.ts의 :id/monthly-schedule에서 따로 조회)
app.get("/:id/monthly-schedule", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const yearMonth = c.req.query("month");
  if (!yearMonth) return c.json({ error: "조회할 월을 지정해주세요." }, 400);

  const rows = await db
    .select()
    .from(participantMonthlySchedule)
    .where(
      and(
        eq(participantMonthlySchedule.participantId, id),
        eq(participantMonthlySchedule.yearMonth, yearMonth),
      ),
    );
  const schedule = rows[0];

  return c.json({
    participantId: id,
    yearMonth,
    workDates: schedule ? (JSON.parse(schedule.workDates) as string[]) : null,
    maxMonthlyMinutes: schedule?.maxMonthlyMinutes ?? null,
  });
});

app.put("/:id/monthly-schedule", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const body = await c.req.json<{
    yearMonth?: string;
    workDates?: string[];
    maxMonthlyMinutes?: number | null;
  }>();
  if (!body.yearMonth || !body.workDates) {
    return c.json({ error: "연월과 근무일을 지정해주세요." }, 400);
  }

  const existingRows = await db
    .select()
    .from(participantMonthlySchedule)
    .where(
      and(
        eq(participantMonthlySchedule.participantId, id),
        eq(participantMonthlySchedule.yearMonth, body.yearMonth),
      ),
    );
  const existing = existingRows[0];
  const workDatesJson = JSON.stringify(body.workDates);
  const maxMonthlyMinutes = body.maxMonthlyMinutes ?? null;

  if (existing) {
    await db
      .update(participantMonthlySchedule)
      .set({ workDates: workDatesJson, maxMonthlyMinutes })
      .where(eq(participantMonthlySchedule.id, existing.id));
    return c.json({
      participantId: id,
      yearMonth: body.yearMonth,
      workDates: body.workDates,
      maxMonthlyMinutes,
    });
  }

  await db.insert(participantMonthlySchedule).values({
    participantId: id,
    yearMonth: body.yearMonth,
    workDates: workDatesJson,
    maxMonthlyMinutes,
  });

  return c.json(
    {
      participantId: id,
      yearMonth: body.yearMonth,
      workDates: body.workDates,
      maxMonthlyMinutes,
    },
    201,
  );
});

// 개인 예외 삭제 — 다시 조 스케줄을 그대로 따르게 한다
app.delete("/:id/monthly-schedule", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const found = await loadParticipantWithProgram(db, id);
  if (!found) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, found.program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const yearMonth = c.req.query("month");
  if (!yearMonth) return c.json({ error: "조회할 월을 지정해주세요." }, 400);

  await db
    .delete(participantMonthlySchedule)
    .where(
      and(
        eq(participantMonthlySchedule.participantId, id),
        eq(participantMonthlySchedule.yearMonth, yearMonth),
      ),
    );

  return c.json({ success: true });
});

export default app;
