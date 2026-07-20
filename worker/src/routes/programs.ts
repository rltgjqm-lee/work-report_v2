import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, inArray, isNull, like, sql } from "drizzle-orm";

import {
  programs,
  participants,
  participantLeaves,
  participantAnnualLeave,
  groups,
  demandSites,
  attendanceLogs,
  activityLogs,
  escapeLogs,
  participantEscapeMeta,
} from "../db/schema";
import { canAccessProgram, getAuth, hasMinRole } from "../lib/authz";
import { getKstNow } from "../lib/kst";
import { ROLES, type Env } from "../types";

const app = new Hono<Env>();

type ProgramBody = {
  organizationId?: number;
  name?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  programType?: string;
  hourlyWage?: number;
  educationAmount?: number;
  educationType?: "add" | "deduct";
  dementiaAmount?: number;
  dementiaType?: "add" | "deduct";
  healthInsuranceRate?: number;
  longtermCareRate?: number;
  employmentInsuranceRate?: number;
  industrialAccidentRate?: number;
  annualLeaveDailyWage?: number;
  isActive?: boolean;
};

app.get("/", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const queryOrgId = c.req.query("organizationId");

  const organizationId =
    auth.role === ROLES.SUPER_ADMIN
      ? queryOrgId
        ? Number(queryOrgId)
        : undefined
      : (auth.organizationId as number);

  const rows = organizationId
    ? await db
        .select()
        .from(programs)
        .where(eq(programs.organizationId, organizationId))
    : await db.select().from(programs);

  const visible =
    auth.role === ROLES.MANAGER
      ? rows.filter((p) => auth.programIds.includes(p.id))
      : rows;

  return c.json(visible);
});

app.get("/:id", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, id));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const participantRows = await db
    .select()
    .from(participants)
    .where(eq(participants.programId, id));

  return c.json({ ...program, participants: participantRows });
});

app.post("/", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const body = await c.req.json<ProgramBody>();

  if (!hasMinRole(auth, ROLES.ORGANIZATION_ADMIN)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const organizationId =
    auth.role === ROLES.SUPER_ADMIN
      ? body.organizationId
      : (auth.organizationId as number);
  const { name, startDate, endDate, startTime, endTime } = body;
  if (
    !organizationId ||
    !name ||
    !startDate ||
    !endDate ||
    !startTime ||
    !endTime
  ) {
    return c.json(
      {
        error:
          "organizationId, name, startDate, endDate, startTime, endTime are required",
      },
      400,
    );
  }

  const result = await db
    .insert(programs)
    .values({
      organizationId,
      name,
      startDate,
      endDate,
      startTime,
      endTime,
      programType: body.programType,
      hourlyWage: body.hourlyWage,
      educationAmount: body.educationAmount,
      educationType: body.educationType,
      dementiaAmount: body.dementiaAmount,
      dementiaType: body.dementiaType,
      healthInsuranceRate: body.healthInsuranceRate,
      longtermCareRate: body.longtermCareRate,
      employmentInsuranceRate: body.employmentInsuranceRate,
      industrialAccidentRate: body.industrialAccidentRate,
      annualLeaveDailyWage: body.annualLeaveDailyWage,
    })
    .returning();

  return c.json(result[0], 201);
});

app.put("/:id", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const existingRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, id));
  const existing = existingRows[0];
  if (!existing) return c.json({ error: "Not found" }, 404);
  // 사업단 수정은 SUB_ADMIN까지 허용 (등록/삭제는 ORGANIZATION_ADMIN 이상)
  if (!hasMinRole(auth, ROLES.SUB_ADMIN) || !canAccessProgram(auth, existing)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<ProgramBody>();

  // 활성/비활성 전환(소프트 삭제)은 ORGANIZATION_ADMIN 이상만 — 일반 정보 수정과는 별개 권한
  if (
    body.isActive !== undefined &&
    !hasMinRole(auth, ROLES.ORGANIZATION_ADMIN)
  ) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const result = await db
    .update(programs)
    .set(body)
    .where(eq(programs.id, id))
    .returning();

  // 💡 사업단을 비활성화하면 소속된 활성 참여자도 함께 참여종료(DROPPED) 처리한다
  // (설계도 5-7-3: 사업단 삭제 시 활성 참여자 자동 탈락)
  if (body.isActive === false) {
    await db
      .update(participants)
      .set({
        status: "DROPPED",
        droppedAt: new Date().toISOString(),
        dropReason: "사업단 종료",
      })
      .where(
        and(eq(participants.programId, id), eq(participants.status, "ACTIVE")),
      );
  }

  return c.json(result[0]);
});

app.get("/:id/groups", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const rows = await db
    .select({
      id: groups.id,
      programId: groups.programId,
      name: groups.name,
      description: groups.description,
      shiftStart: groups.shiftStart,
      shiftEnd: groups.shiftEnd,
      isActive: groups.isActive,
      createdAt: groups.createdAt,
      participantCount: sql<number>`COALESCE(SUM(CASE WHEN ${participants.status} = 'ACTIVE' THEN 1 ELSE 0 END), 0)`,
    })
    .from(groups)
    .leftJoin(participants, eq(participants.groupId, groups.id))
    .where(eq(groups.programId, programId))
    .groupBy(groups.id);

  return c.json(rows);
});

app.post("/:id/groups", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{
    name?: string;
    description?: string;
    shiftStart?: string;
    shiftEnd?: string;
  }>();

  if (!body.name || !body.shiftStart || !body.shiftEnd) {
    return c.json({ error: "name, shiftStart, shiftEnd are required" }, 400);
  }

  const result = await db
    .insert(groups)
    .values({
      programId,
      name: body.name,
      description: body.description,
      shiftStart: body.shiftStart,
      shiftEnd: body.shiftEnd,
    })
    .returning();

  return c.json(result[0], 201);
});

app.get("/:id/participants", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const rows = await db
    .select()
    .from(participants)
    .where(eq(participants.programId, programId));

  return c.json(rows);
});

app.post("/:id/participants", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{
    name?: string;
    demandName?: string;
    demandSiteId?: number;
    phoneLast4?: string;
    groupId?: number;
    birthYear?: number;
  }>();

  if (!body.name) {
    return c.json({ error: "name is required" }, 400);
  }
  if (!body.phoneLast4 || !/^\d{4}$/.test(body.phoneLast4)) {
    return c.json({ error: "phoneLast4 must be 4 digits" }, 400);
  }
  if (body.demandSiteId) {
    const demandSiteRows = await db
      .select()
      .from(demandSites)
      .where(eq(demandSites.id, body.demandSiteId));
    if (demandSiteRows[0]?.programId !== programId) {
      return c.json({ error: "해당 사업단의 수요처가 아닙니다." }, 400);
    }
  }

  const result = await db
    .insert(participants)
    .values({
      programId,
      name: body.name,
      demandName: body.demandName,
      demandSiteId: body.demandSiteId,
      phoneLast4: body.phoneLast4,
      groupId: body.groupId,
      birthYear: body.birthYear,
    })
    .returning();

  return c.json(result[0], 201);
});

app.post("/:id/participants/bulk", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{
    participants?: {
      name?: string;
      demandName?: string;
      demandSiteId?: number;
      phoneLast4?: string;
      groupId?: number;
      birthYear?: number;
    }[];
  }>();

  const rows = body.participants ?? [];
  if (rows.length === 0) {
    return c.json({ error: "participants must be a non-empty array" }, 400);
  }

  const errors: { index: number; error: string }[] = [];
  rows.forEach((row, index) => {
    if (!row.name) {
      errors.push({ index, error: "name is required" });
    } else if (!row.phoneLast4 || !/^\d{4}$/.test(row.phoneLast4)) {
      errors.push({ index, error: "phoneLast4 must be 4 digits" });
    }
  });

  if (errors.length > 0) {
    return c.json({ error: "validation failed", details: errors }, 400);
  }

  const result = await db
    .insert(participants)
    .values(
      rows.map((row) => ({
        programId,
        name: row.name!,
        demandName: row.demandName,
        demandSiteId: row.demandSiteId,
        phoneLast4: row.phoneLast4!,
        groupId: row.groupId,
        birthYear: row.birthYear,
      })),
    )
    .returning();

  return c.json(result, 201);
});

app.delete("/:id/participants/:participantId", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));
  const participantId = Number(c.req.param("participantId"));

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // 💡 참여자를 참조하는 자식 테이블을 먼저 지워야 FOREIGN KEY constraint failed 없이
  // 삭제가 성공한다 (사업단 삭제 라우트와 동일한 이유)
  await db
    .delete(activityLogs)
    .where(eq(activityLogs.participantId, participantId));
  await db
    .delete(participantLeaves)
    .where(eq(participantLeaves.participantId, participantId));
  await db
    .delete(attendanceLogs)
    .where(eq(attendanceLogs.participantId, participantId));

  const result = await db
    .delete(participants)
    .where(
      and(
        eq(participants.id, participantId),
        eq(participants.programId, programId),
      ),
    )
    .returning();

  if (!result[0]) return c.json({ error: "Not found" }, 404);
  return c.json({ success: true });
});

// 여러 참여자를 한 번에 탈락/재활성화 처리
app.post("/:id/participants/bulk-status", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{
    participantIds?: number[];
    status?: "ACTIVE" | "DROPPED";
    dropReason?: string;
  }>();

  if (!body.participantIds?.length || !body.status) {
    return c.json({ error: "participantIds, status are required" }, 400);
  }

  const targetRows = await db
    .select()
    .from(participants)
    .where(
      and(
        eq(participants.programId, programId),
        inArray(participants.id, body.participantIds),
      ),
    );

  if (body.status === "DROPPED") {
    const result = await db
      .update(participants)
      .set({
        status: "DROPPED",
        droppedAt: new Date().toISOString(),
        dropReason: body.dropReason,
      })
      .where(
        inArray(
          participants.id,
          targetRows.map((row) => row.id),
        ),
      )
      .returning();
    return c.json(result);
  }

  const reactivatableIds = targetRows
    .filter((row) => row.status === "DROPPED")
    .map((row) => row.id);
  if (reactivatableIds.length === 0) return c.json([]);

  const result = await db
    .update(participants)
    .set({ status: "ACTIVE", droppedAt: null, dropReason: null })
    .where(inArray(participants.id, reactivatableIds))
    .returning();
  return c.json(result);
});

app.get("/:id/attendance", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));
  const month = c.req.query("month"); // "YYYY-MM"

  if (!month) return c.json({ error: "month is required" }, 400);

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const rows = await db
    .select({
      log: attendanceLogs,
      participantName: participants.name,
      groupName: groups.name,
      shiftStart: groups.shiftStart,
      shiftEnd: groups.shiftEnd,
    })
    .from(attendanceLogs)
    .innerJoin(participants, eq(attendanceLogs.participantId, participants.id))
    .leftJoin(groups, eq(attendanceLogs.groupId, groups.id))
    .where(
      and(
        eq(attendanceLogs.programId, programId),
        like(attendanceLogs.workDate, `${month}%`),
      ),
    );

  const stats = {
    total: rows.length,
    normal: rows.filter((row) => row.log.status === "NORMAL").length,
    late: rows.filter((row) => row.log.status === "LATE").length,
    earlyLeave: rows.filter((row) => row.log.status === "EARLY_LEAVE").length,
    totalHours: Math.floor(
      rows.reduce((sum, row) => sum + (row.log.totalMinutes ?? 0), 0) / 60,
    ),
  };

  return c.json({ logs: rows, stats });
});

app.get("/:id/leaves", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));
  const month = c.req.query("month"); // "YYYY-MM"

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const conditions = [eq(participants.programId, programId)];
  if (month) conditions.push(like(participantLeaves.leaveStart, `${month}%`));

  const rows = await db
    .select({
      leave: participantLeaves,
      participantName: participants.name,
      groupName: groups.name,
    })
    .from(participantLeaves)
    .innerJoin(
      participants,
      eq(participantLeaves.participantId, participants.id),
    )
    .leftJoin(groups, eq(participants.groupId, groups.id))
    .where(and(...conditions))
    .orderBy(sql`${participantLeaves.leaveStart} DESC`);

  return c.json(rows);
});

app.get("/:id/leaves/stats", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));
  const year = c.req.query("year") ?? new Date().getFullYear().toString();

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const leaveRows = await db
    .select({ leave: participantLeaves })
    .from(participantLeaves)
    .innerJoin(
      participants,
      eq(participantLeaves.participantId, participants.id),
    )
    .where(
      and(
        eq(participants.programId, programId),
        like(participantLeaves.leaveStart, `${year}%`),
      ),
    );

  const monthly = Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    const monthRows = leaveRows.filter(
      (row) => row.leave.leaveStart.slice(5, 7) === month,
    );
    return {
      month,
      totalLeaves: monthRows.length,
      paidLeaves: monthRows.filter((row) => row.leave.leaveType === "PAID")
        .length,
      unpaidLeaves: monthRows.filter((row) => row.leave.leaveType === "UNPAID")
        .length,
      totalDays: monthRows.reduce((sum, row) => sum + row.leave.leaveDays, 0),
    };
  });

  const annualRows = await db
    .select({ annual: participantAnnualLeave })
    .from(participantAnnualLeave)
    .innerJoin(
      participants,
      eq(participantAnnualLeave.participantId, participants.id),
    )
    .where(
      and(
        eq(participants.programId, programId),
        eq(participantAnnualLeave.year, year),
      ),
    );

  const annual = {
    participants: annualRows.length,
    totalAnnual: annualRows.reduce((sum, row) => sum + row.annual.totalDays, 0),
    usedAnnual: annualRows.reduce((sum, row) => sum + row.annual.usedDays, 0),
    remainingAnnual: annualRows.reduce(
      (sum, row) => sum + row.annual.remainingDays,
      0,
    ),
  };

  return c.json({ monthly, annual });
});

app.get("/:id/escapes", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));
  const status = c.req.query("status") ?? "OPEN";

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const rows = await db
    .select({
      escape: escapeLogs,
      participantName: participants.name,
      groupName: groups.name,
      demandSiteName: demandSites.name,
    })
    .from(escapeLogs)
    .innerJoin(participants, eq(escapeLogs.participantId, participants.id))
    .leftJoin(groups, eq(participants.groupId, groups.id))
    .leftJoin(demandSites, eq(escapeLogs.demandSiteId, demandSites.id))
    .where(
      and(
        eq(escapeLogs.programId, programId),
        eq(escapeLogs.status, status as "OPEN" | "RESOLVED"),
      ),
    )
    .orderBy(sql`${escapeLogs.detectedAt} DESC`);

  return c.json(rows);
});

// 관제 지도용 — 오늘 출근 중인 전체 활성 참여자의 마지막 위치+이탈상태
app.get("/:id/workers/live", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const { date } = getKstNow();

  const rows = await db
    .select({
      participantId: participants.id,
      name: participants.name,
      groupName: groups.name,
      demandSiteName: demandSites.name,
      lat: participantEscapeMeta.lastLat,
      lng: participantEscapeMeta.lastLng,
      lastLocationAt: participantEscapeMeta.lastLocationAt,
      alertCount: participantEscapeMeta.alertCount,
      outsideStart: participantEscapeMeta.outsideStart,
    })
    .from(participants)
    .innerJoin(
      attendanceLogs,
      and(
        eq(attendanceLogs.participantId, participants.id),
        eq(attendanceLogs.workDate, date),
        isNull(attendanceLogs.clockOut),
      ),
    )
    .leftJoin(groups, eq(participants.groupId, groups.id))
    .leftJoin(demandSites, eq(participants.demandSiteId, demandSites.id))
    .leftJoin(
      participantEscapeMeta,
      eq(participantEscapeMeta.participantId, participants.id),
    )
    .where(
      and(
        eq(participants.programId, programId),
        eq(participants.status, "ACTIVE"),
      ),
    );

  const workers = rows.map((row) => ({
    participantId: row.participantId,
    name: row.name,
    groupName: row.groupName ?? "미배정",
    demandSiteName: row.demandSiteName ?? "수요처 미배정",
    lat: row.lat,
    lng: row.lng,
    lastLocationAt: row.lastLocationAt,
    alertCount: row.alertCount ?? 0,
    status: row.outsideStart ? ("ESCAPE" as const) : ("NORMAL" as const),
  }));

  return c.json(workers);
});

export default app;
