import { and, eq, getTableColumns, inArray, isNull, like, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

import { ROLES, type Env } from "../../types";

import {
  activityLogs,
  admins,
  attendanceLogs,
  demandSites,
  demandSiteSchedules,
  escapeLogs,
  groups,
  organizations,
  participantAnnualLeave,
  participantEscapeMeta,
  participantGroupOverrides,
  participantLeaves,
  participantMonthlySchedule,
  participants,
  participantTrainingLogs,
  programs,
  pushDeviceTokens,
  pushSubscriptions,
  sosEvents,
} from "../../db/schema";
import { canAccessProgram, getAuth, hasMinRole, parseIdArray } from "../../lib/authz";
import { matchEscapeToWorkDate } from "../../lib/escapeMatching";
import { getKstNow } from "../../lib/kst";

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
  healthInsuranceRate?: number;
  longtermCareRate?: number;
  employmentInsuranceRate?: number;
  employmentInsuranceEmployerRate?: number;
  industrialAccidentRate?: number;
  annualLeaveDailyWage?: number;
  activityLogTitle?: string | null;
  capacityAttendanceBannerText?: string | null;
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
    ? await db.select().from(programs).where(eq(programs.organizationId, organizationId))
    : await db.select().from(programs);

  const visible =
    auth.role === ROLES.MANAGER ? rows.filter((p) => auth.programIds.includes(p.id)) : rows;

  return c.json(visible);
});

// 사업단 관리 목록 화면용 — 참여자 수 집계, 소속 기관명, 담당자명까지 서버에서 한 번에
// 조합해서 내려준다. `/:id`보다 먼저 등록해야 "summary"가 id로 안 잡힌다.
app.get("/summary", async (c) => {
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
    ? await db.select().from(programs).where(eq(programs.organizationId, organizationId))
    : await db.select().from(programs);

  const visible =
    auth.role === ROLES.MANAGER ? rows.filter((p) => auth.programIds.includes(p.id)) : rows;

  if (visible.length === 0) return c.json([]);

  const organizationIds = [...new Set(visible.map((program) => program.organizationId))];

  const participantCountRows = await db
    .select({ programId: participants.programId, count: sql<number>`count(*)` })
    .from(participants)
    .where(
      inArray(
        participants.programId,
        visible.map((program) => program.id),
      ),
    )
    .groupBy(participants.programId);
  const participantCountByProgramId = new Map(
    participantCountRows.map((row) => [row.programId, row.count]),
  );

  const organizationRows = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(inArray(organizations.id, organizationIds));
  const organizationNameById = new Map(
    organizationRows.map((organization) => [organization.id, organization.name]),
  );

  // 담당자 열은 계정 목록(GET /api/admins)과 같은 기준으로 가린다 — SUB_ADMIN/MANAGER는 못 본다.
  const canViewManager = hasMinRole(auth, ROLES.ORGANIZATION_ADMIN);
  const managerCandidates = canViewManager
    ? await db
        .select({ name: admins.name, email: admins.email, programIds: admins.programIds })
        .from(admins)
        .where(
          and(
            inArray(admins.organizationId, organizationIds),
            inArray(admins.role, [ROLES.MANAGER, ROLES.SUB_ADMIN]),
            eq(admins.isActive, true),
          ),
        )
    : [];
  const managerNameByProgramId = (programId: number) => {
    const manager = managerCandidates.find((candidate) =>
      parseIdArray(candidate.programIds).includes(programId),
    );
    return manager?.name ?? manager?.email ?? "-";
  };

  const summaries = visible.map((program) => ({
    id: program.id,
    organizationId: program.organizationId,
    organizationName: organizationNameById.get(program.organizationId) ?? "-",
    name: program.name,
    startDate: program.startDate,
    endDate: program.endDate,
    startTime: program.startTime,
    endTime: program.endTime,
    programType: program.programType,
    isActive: program.isActive,
    participantCount: participantCountByProgramId.get(program.id) ?? 0,
    managerName: canViewManager ? managerNameByProgramId(program.id) : "-",
  }));

  return c.json(summaries);
});

app.get("/:id", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const programRows = await db.select().from(programs).where(eq(programs.id, id));
  const program = programRows[0];
  if (!program) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  // demandName(자유 텍스트)이 비어있어도 demandSiteId로 실제 수요처가 배정된
  // 참여자는 있을 수 있어서, 그 경우 수요처명을 채워서 내려준다.
  // 소속 기관명도 같이 내려준다 — ProgramDetailPage가 이걸 따로 순차 조회(waterfall)하지
  // 않아도 되게 하기 위함.
  const [participantRows, organizationRows] = await Promise.all([
    db
      .select({
        ...getTableColumns(participants),
        demandSiteName: demandSites.name,
      })
      .from(participants)
      .leftJoin(demandSites, eq(participants.demandSiteId, demandSites.id))
      .where(eq(participants.programId, id)),
    db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, program.organizationId)),
  ]);

  // 오늘 하루만 다른 조로 임시 배정된 참여자가 있으면 목록에서 바로 보이도록 같이 내려준다.
  const { date: today } = getKstNow();
  const todayOverrideRows =
    participantRows.length === 0
      ? []
      : await db
          .select({
            participantId: participantGroupOverrides.participantId,
            groupId: participantGroupOverrides.groupId,
            groupName: groups.name,
          })
          .from(participantGroupOverrides)
          .innerJoin(groups, eq(participantGroupOverrides.groupId, groups.id))
          .where(
            and(
              eq(participantGroupOverrides.date, today),
              inArray(
                participantGroupOverrides.participantId,
                participantRows.map((row) => row.id),
              ),
            ),
          );
  const todayOverrideByParticipantId = new Map(
    todayOverrideRows.map((override) => [override.participantId, override]),
  );

  const resolvedParticipants = participantRows.map((row) => {
    const { demandSiteName, ...participant } = row;
    const todayOverride = todayOverrideByParticipantId.get(participant.id);
    return {
      ...participant,
      demandName: participant.demandName ?? demandSiteName ?? null,
      todayGroupOverride: todayOverride
        ? { groupId: todayOverride.groupId, groupName: todayOverride.groupName }
        : null,
    };
  });

  return c.json({
    ...program,
    organizationName: organizationRows[0]?.name ?? null,
    participants: resolvedParticipants,
  });
});

// 수정 폼·breadcrumb처럼 참여자 목록 없이 사업단 필드만 필요한 소비자용 — 참여자 조인을 스킵한다.
app.get("/:id/edit", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const programRows = await db.select().from(programs).where(eq(programs.id, id));
  const program = programRows[0];
  if (!program) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  return c.json(program);
});

app.post("/", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const body = await c.req.json<ProgramBody>();

  if (!hasMinRole(auth, ROLES.ORGANIZATION_ADMIN)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const organizationId =
    auth.role === ROLES.SUPER_ADMIN ? body.organizationId : (auth.organizationId as number);
  const { name, startDate, endDate, startTime, endTime } = body;
  if (!organizationId || !name || !startDate || !endDate || !startTime || !endTime) {
    return c.json(
      {
        error: "기관, 사업단명, 시작일, 종료일, 시작 시간, 종료 시간을 모두 입력해주세요.",
      },
      400,
    );
  }

  const duplicateRows = await db
    .select({ id: programs.id })
    .from(programs)
    .where(and(eq(programs.organizationId, organizationId), eq(programs.name, name)));
  if (duplicateRows.length > 0) {
    return c.json({ error: "같은 기관에 동일한 이름의 사업단이 이미 있습니다." }, 400);
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
      healthInsuranceRate: body.healthInsuranceRate,
      longtermCareRate: body.longtermCareRate,
      employmentInsuranceRate: body.employmentInsuranceRate,
      employmentInsuranceEmployerRate: body.employmentInsuranceEmployerRate,
      industrialAccidentRate: body.industrialAccidentRate,
      annualLeaveDailyWage: body.annualLeaveDailyWage,
    })
    .returning();

  return c.json(result[0], 201);
});

// 사업단 담당자 지정 — 담당자는 MANAGER 또는 SUB_ADMIN 계정의 programIds로 표현되므로,
// 이전 담당자에게서 떼어내고 새 담당자에게 붙이는 걸 한 번에 처리한다. 소속 수요처 담당자를
// 같이 갈아끼울지는 관리자가 고른다(updateDemandSiteContacts) — 기본값은 지금까지의 동작과
// 같게 true.
app.put("/:id/manager", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));

  const programRows = await db.select().from(programs).where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  if (!hasMinRole(auth, ROLES.ORGANIZATION_ADMIN) || !canAccessProgram(auth, program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const body = await c.req.json<{ adminId?: number | null; updateDemandSiteContacts?: boolean }>();
  const nextManagerId = body.adminId ?? null;
  const updateDemandSiteContacts = body.updateDemandSiteContacts ?? true;

  const managerCandidates = await db
    .select({ id: admins.id, programIds: admins.programIds })
    .from(admins)
    .where(
      and(
        eq(admins.organizationId, program.organizationId),
        inArray(admins.role, [ROLES.MANAGER, ROLES.SUB_ADMIN]),
      ),
    );

  if (
    nextManagerId !== null &&
    !managerCandidates.some((candidate) => candidate.id === nextManagerId)
  ) {
    return c.json({ error: "이 기관의 담당자 또는 부관리자 계정이 아닙니다." }, 400);
  }

  const managerUpdates = managerCandidates.flatMap((candidate) => {
    const assignedProgramIds = parseIdArray(candidate.programIds);

    const shouldHave = candidate.id === nextManagerId;
    const has = assignedProgramIds.includes(programId);
    if (shouldHave === has) return [];

    const nextProgramIds = shouldHave
      ? [...assignedProgramIds, programId]
      : assignedProgramIds.filter((assignedProgramId) => assignedProgramId !== programId);

    return [
      db
        .update(admins)
        .set({ programIds: JSON.stringify(nextProgramIds) })
        .where(eq(admins.id, candidate.id)),
    ];
  });

  // 계정 정리와 수요처 전파(선택)를 하나로 묶어 보낸다(D1 batch = 단일 트랜잭션) — 중간에
  // 실패해서 한쪽만 반영되면 사업단과 수요처의 담당자가 서로 어긋난다.
  const operations = [
    ...(updateDemandSiteContacts
      ? [
          db
            .update(demandSites)
            .set({ contactAdminId: nextManagerId })
            .where(eq(demandSites.programId, programId)),
        ]
      : []),
    ...managerUpdates,
  ];
  if (operations.length > 0) {
    await db.batch(operations as unknown as Parameters<typeof db.batch>[0]);
  }

  return c.json({ ok: true, adminId: nextManagerId });
});

app.put("/:id", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));

  const existingRows = await db.select().from(programs).where(eq(programs.id, id));
  const existing = existingRows[0];
  if (!existing) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  // 사업단 수정은 SUB_ADMIN까지 허용 (등록/삭제는 ORGANIZATION_ADMIN 이상)
  if (!hasMinRole(auth, ROLES.SUB_ADMIN) || !canAccessProgram(auth, existing)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const body = await c.req.json<ProgramBody>();

  // 활성/비활성 전환(소프트 삭제)은 ORGANIZATION_ADMIN 이상만 — 일반 정보 수정과는 별개 권한
  if (body.isActive !== undefined && !hasMinRole(auth, ROLES.ORGANIZATION_ADMIN)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const result = await db.update(programs).set(body).where(eq(programs.id, id)).returning();

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
      .where(and(eq(participants.programId, id), eq(participants.status, "ACTIVE")));
  }

  return c.json(result[0]);
});

app.get("/:id/groups", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));

  const programRows = await db.select().from(programs).where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
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

  const programRows = await db.select().from(programs).where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const body = await c.req.json<{
    name?: string;
    description?: string;
    shiftStart?: string;
    shiftEnd?: string;
  }>();

  if (!body.name || !body.shiftStart || !body.shiftEnd) {
    return c.json({ error: "조 이름과 근무 시작 시간, 종료 시간을 모두 입력해주세요." }, 400);
  }

  const duplicateRows = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.programId, programId), eq(groups.name, body.name)));
  if (duplicateRows.length > 0) {
    return c.json({ error: "같은 사업단에 동일한 이름의 조가 이미 있습니다." }, 400);
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
  const demandSiteIdParam = c.req.query("demandSiteId");

  const programRows = await db.select().from(programs).where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const conditions = [eq(participants.programId, programId)];
  if (demandSiteIdParam) {
    conditions.push(eq(participants.demandSiteId, Number(demandSiteIdParam)));
  }

  const rows = await db
    .select()
    .from(participants)
    .where(and(...conditions));

  return c.json(rows);
});

app.post("/:id/participants", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));

  const programRows = await db.select().from(programs).where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const body = await c.req.json<{
    name?: string;
    gender?: "남성" | "여성";
    demandSiteId?: number;
    groupId?: number;
    birthYear?: number;
  }>();

  if (!body.name) {
    return c.json({ error: "이름을 입력해주세요." }, 400);
  }
  if (body.gender !== "남성" && body.gender !== "여성") {
    return c.json({ error: "성별을 선택해주세요." }, 400);
  }
  if (!body.demandSiteId) {
    return c.json({ error: "수요처를 선택해주세요." }, 400);
  }
  if (!body.groupId) {
    return c.json({ error: "조를 선택해주세요." }, 400);
  }
  const demandSiteRows = await db
    .select()
    .from(demandSites)
    .where(eq(demandSites.id, body.demandSiteId));
  if (demandSiteRows[0]?.programId !== programId) {
    return c.json({ error: "해당 사업단의 수요처가 아닙니다." }, 400);
  }
  // 조와 수요처가 각각 유효해도, 그 조가 이 수요처에서 근무하도록 배정돼있지 않으면
  // 출근 시점에야 뒤늦게 드러난다(public.ts) — 등록 시점에 미리 막는다.
  const scheduleRows = await db
    .select({ id: demandSiteSchedules.id })
    .from(demandSiteSchedules)
    .where(
      and(
        eq(demandSiteSchedules.demandSiteId, body.demandSiteId),
        eq(demandSiteSchedules.groupId, body.groupId),
      ),
    );
  if (scheduleRows.length === 0) {
    return c.json(
      { error: "이 조는 해당 수요처에 배정되지 않았습니다. 먼저 수요처에서 조를 배정해주세요." },
      400,
    );
  }

  const duplicateRows = await db
    .select()
    .from(participants)
    .where(
      and(
        eq(participants.programId, programId),
        eq(participants.name, body.name),
        eq(participants.gender, body.gender),
        ne(participants.status, "DROPPED"),
      ),
    );
  if (duplicateRows.length > 0) {
    return c.json({ error: "이름과 성별이 같은 참여자가 이미 등록되어 있습니다." }, 400);
  }

  const result = await db
    .insert(participants)
    .values({
      programId,
      name: body.name,
      gender: body.gender,
      demandSiteId: body.demandSiteId,
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

  const programRows = await db.select().from(programs).where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const body = await c.req.json<{
    participants?: {
      name?: string;
      gender?: "남성" | "여성";
      demandSiteId?: number;
      groupId?: number;
      birthYear?: number;
    }[];
  }>();

  const rows = body.participants ?? [];
  if (rows.length === 0) {
    return c.json({ error: "등록할 참여자가 없습니다." }, 400);
  }

  const existingParticipants = await db
    .select({ name: participants.name, gender: participants.gender })
    .from(participants)
    .where(and(eq(participants.programId, programId), ne(participants.status, "DROPPED")));
  const existingKeys = new Set(
    existingParticipants.map((participant) => `${participant.name}|${participant.gender}`),
  );
  const seenInBatch = new Set<string>();

  // 조와 수요처가 각각 유효해도, 그 조가 이 수요처에서 근무하도록 배정돼있지 않으면
  // 출근 시점에야 뒤늦게 드러난다(public.ts) — 등록 시점에 미리 막는다.
  const scheduleRows = await db
    .select({
      demandSiteId: demandSiteSchedules.demandSiteId,
      groupId: demandSiteSchedules.groupId,
    })
    .from(demandSiteSchedules)
    .innerJoin(demandSites, eq(demandSiteSchedules.demandSiteId, demandSites.id))
    .where(eq(demandSites.programId, programId));
  const assignedPairs = new Set(
    scheduleRows.map((schedule) => `${schedule.demandSiteId}|${schedule.groupId}`),
  );

  const errors: { index: number; error: string }[] = [];
  rows.forEach((row, index) => {
    if (!row.name) {
      errors.push({ index, error: "이름을 입력해주세요." });
    }
    if (row.gender !== "남성" && row.gender !== "여성") {
      errors.push({ index, error: "성별을 선택해주세요." });
    }
    if (!row.demandSiteId) {
      errors.push({ index, error: "수요처를 선택해주세요." });
    }
    if (!row.groupId) {
      errors.push({ index, error: "조를 선택해주세요." });
    }
    if (
      row.demandSiteId &&
      row.groupId &&
      !assignedPairs.has(`${row.demandSiteId}|${row.groupId}`)
    ) {
      errors.push({ index, error: "이 조는 해당 수요처에 배정되지 않았습니다." });
    }
    if (row.name && (row.gender === "남성" || row.gender === "여성")) {
      const key = `${row.name}|${row.gender}`;
      if (existingKeys.has(key) || seenInBatch.has(key)) {
        errors.push({ index, error: "이름과 성별이 같은 참여자가 이미 등록되어 있습니다." });
      }
      seenInBatch.add(key);
    }
  });

  if (errors.length > 0) {
    const summary = errors
      .map(({ index, error }) => `${rows[index]?.name || `${index + 1}번째 행`}: ${error}`)
      .join(", ");
    return c.json({ error: `입력값을 확인해주세요 — ${summary}`, details: errors }, 400);
  }

  const result = await db
    .insert(participants)
    .values(
      rows.map((row) => ({
        programId,
        name: row.name!,
        gender: row.gender,
        demandSiteId: row.demandSiteId,
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

  const programRows = await db.select().from(programs).where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  // 💡 참여자를 참조하는 자식 테이블을 먼저 지워야 FOREIGN KEY constraint failed 없이
  // 삭제가 성공한다 (사업단 삭제 라우트와 동일한 이유) — 새 참조 테이블이 생기면 여기도 같이 늘려야 한다.
  await db.delete(activityLogs).where(eq(activityLogs.participantId, participantId));
  await db.delete(participantLeaves).where(eq(participantLeaves.participantId, participantId));
  await db.delete(attendanceLogs).where(eq(attendanceLogs.participantId, participantId));
  await db
    .delete(participantAnnualLeave)
    .where(eq(participantAnnualLeave.participantId, participantId));
  await db.delete(escapeLogs).where(eq(escapeLogs.participantId, participantId));
  await db
    .delete(participantEscapeMeta)
    .where(eq(participantEscapeMeta.participantId, participantId));
  await db
    .delete(participantGroupOverrides)
    .where(eq(participantGroupOverrides.participantId, participantId));
  await db
    .delete(participantMonthlySchedule)
    .where(eq(participantMonthlySchedule.participantId, participantId));
  await db
    .delete(participantTrainingLogs)
    .where(eq(participantTrainingLogs.participantId, participantId));
  // 푸시 구독/기기 자체는 프로그램 단위로도 쓰이므로 지우지 않고 참여자 연결만 해제
  await db
    .update(pushSubscriptions)
    .set({ participantId: null })
    .where(eq(pushSubscriptions.participantId, participantId));
  await db
    .update(pushDeviceTokens)
    .set({ participantId: null })
    .where(eq(pushDeviceTokens.participantId, participantId));

  const result = await db
    .delete(participants)
    .where(and(eq(participants.id, participantId), eq(participants.programId, programId)))
    .returning();

  if (!result[0]) return c.json({ error: "참여자를 찾을 수 없습니다." }, 404);
  return c.json({ success: true });
});

// 여러 참여자를 한 번에 탈락/재활성화 처리
app.post("/:id/participants/bulk-status", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));

  const programRows = await db.select().from(programs).where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const body = await c.req.json<{
    participantIds?: number[];
    status?: "ACTIVE" | "DROPPED";
    dropReason?: string;
  }>();

  if (!body.participantIds?.length || !body.status) {
    return c.json({ error: "참여자와 변경할 상태를 지정해주세요." }, 400);
  }

  const targetRows = await db
    .select()
    .from(participants)
    .where(
      and(eq(participants.programId, programId), inArray(participants.id, body.participantIds)),
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
  const demandSiteIdParam = c.req.query("demandSiteId");

  if (!month) return c.json({ error: "조회할 월을 지정해주세요." }, 400);

  const programRows = await db.select().from(programs).where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  // 수요처 필터가 있으면 그 수요처 소속 참여자의 근무 기록만 DB에서 바로 걸러서 내려준다
  // (참여자 목록을 따로 받아 브라우저에서 다시 조인할 필요가 없게).
  const conditions = [
    eq(attendanceLogs.programId, programId),
    like(attendanceLogs.workDate, `${month}%`),
  ];
  if (demandSiteIdParam) {
    conditions.push(eq(participants.demandSiteId, Number(demandSiteIdParam)));
  }

  const rows = await db
    .select({
      log: attendanceLogs,
      participantName: participants.name,
      groupName: groups.name,
      shiftStart: groups.shiftStart,
      shiftEnd: groups.shiftEnd,
      activityLogId: activityLogs.id,
      hasAccident: activityLogs.hasAccident,
      accidentChecked: activityLogs.accidentChecked,
      accidentDetail: activityLogs.accidentDetail,
      accidentAction: activityLogs.accidentAction,
      userSignature: activityLogs.userSignature,
    })
    .from(attendanceLogs)
    .innerJoin(participants, eq(attendanceLogs.participantId, participants.id))
    .leftJoin(groups, eq(attendanceLogs.groupId, groups.id))
    // 같은 참여자+날짜의 활동일지(업무/안전/서명)를 붙여 미완료 여부를 같이 내려준다.
    .leftJoin(
      activityLogs,
      and(
        eq(activityLogs.participantId, attendanceLogs.participantId),
        eq(activityLogs.actDate, attendanceLogs.workDate),
      ),
    )
    .where(and(...conditions));

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
  // detectedAt이 이 월 안이면 workDate도 반드시 같은 월이라(위 attendanceLogs 필터와
  // 동일한 이유) 이 범위로 좁혀도 매칭 결과는 전체 조회와 같다.
  const escapeRows = await db
    .select({
      participantId: escapeLogs.participantId,
      detectedAt: escapeLogs.detectedAt,
      status: escapeLogs.status,
      memo: escapeLogs.memo,
    })
    .from(escapeLogs)
    .where(and(eq(escapeLogs.programId, programId), like(escapeLogs.detectedAt, `${month}%`)));

  // 원본 서명 텍스트(base64)는 목록 응답에 실을 필요가 없어 있는지 여부만 boolean으로 내려준다.
  const logs = dedupedRows.map((row) => {
    const matchedEscape = matchEscapeToWorkDate(
      escapeRows,
      row.log.participantId,
      row.log.workDate,
    );

    return {
      log: row.log,
      participantName: row.participantName,
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

// 연도 전체 휴가 행을 한 번만 조회해서 원본 목록과 월별 집계를 같이 내려준다 — 월별
// 집계가 어차피 그 해 전체를 훑어야 나오는 값이라, 월 목록을 따로 또 조회할 필요가
// 없다. 프론트는 월을 바꿔도(같은 연도 안이면) 이 응답을 다시 걸러 쓰기만 하면 된다.
app.get("/:id/leaves", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));
  const year = c.req.query("year") ?? getKstNow().date.slice(0, 4);
  const demandSiteIdParam = c.req.query("demandSiteId");

  const programRows = await db.select().from(programs).where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const conditions = [
    eq(participants.programId, programId),
    like(participantLeaves.leaveStart, `${year}%`),
  ];
  if (demandSiteIdParam) {
    conditions.push(eq(participants.demandSiteId, Number(demandSiteIdParam)));
  }

  const rows = await db
    .select({
      leave: participantLeaves,
      participantName: participants.name,
      groupName: groups.name,
      annualTotalDays: participantAnnualLeave.totalDays,
      annualUsedDays: participantAnnualLeave.usedDays,
      annualRemainingDays: participantAnnualLeave.remainingDays,
    })
    .from(participantLeaves)
    .innerJoin(participants, eq(participantLeaves.participantId, participants.id))
    .leftJoin(groups, eq(participants.groupId, groups.id))
    .leftJoin(
      participantAnnualLeave,
      and(
        eq(participantAnnualLeave.participantId, participantLeaves.participantId),
        eq(participantAnnualLeave.year, sql`substr(${participantLeaves.leaveStart}, 1, 4)`),
      ),
    )
    .where(and(...conditions))
    .orderBy(sql`${participantLeaves.leaveStart} DESC`);

  const monthly = Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    const monthRows = rows.filter((row) => row.leave.leaveStart.slice(5, 7) === month);
    return {
      month,
      totalLeaves: monthRows.length,
      paidLeaves: monthRows.filter((row) => row.leave.leaveType === "PAID").length,
      unpaidLeaves: monthRows.filter((row) => row.leave.leaveType === "UNPAID").length,
      totalDays: monthRows.reduce((sum, row) => sum + row.leave.leaveDays, 0),
    };
  });

  return c.json({ leaves: rows, monthly });
});

app.get("/:id/escapes", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));
  const status = c.req.query("status") ?? "OPEN";

  const programRows = await db.select().from(programs).where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const conditions = [eq(escapeLogs.programId, programId)];
  if (status !== "ALL") {
    conditions.push(eq(escapeLogs.status, status as "OPEN" | "RESOLVED"));
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
    .where(and(...conditions))
    .orderBy(sql`${escapeLogs.detectedAt} DESC`);

  return c.json(rows);
});

// 안전 관제 지도용 — 실시간 근무자 위치와 확인 필요(OPEN) 이탈을 한 번에 내려준다.
// EscapesPage가 둘 다 10초 폴링으로 같이 쓰는 데이터라 폴링 요청을 하나로 묶는다.
app.get("/:id/live-map", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const programId = Number(c.req.param("id"));

  const programRows = await db.select().from(programs).where(eq(programs.id, programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "사업단을 찾을 수 없습니다." }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const { date } = getKstNow();

  const [openEscapeRows, openSosRows, workerRows] = await Promise.all([
    db
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
      .where(and(eq(escapeLogs.programId, programId), eq(escapeLogs.status, "OPEN")))
      .orderBy(sql`${escapeLogs.detectedAt} DESC`),
    db
      .select({
        sos: sosEvents,
        participantName: participants.name,
        groupName: groups.name,
        demandSiteName: demandSites.name,
      })
      .from(sosEvents)
      .innerJoin(participants, eq(sosEvents.participantId, participants.id))
      .leftJoin(groups, eq(participants.groupId, groups.id))
      .leftJoin(demandSites, eq(sosEvents.demandSiteId, demandSites.id))
      .where(and(eq(sosEvents.programId, programId), eq(sosEvents.status, "OPEN")))
      .orderBy(sql`${sosEvents.triggeredAt} DESC`),
    db
      .select({
        participantId: participants.id,
        name: participants.name,
        groupName: groups.name,
        demandSiteId: participants.demandSiteId,
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
      .leftJoin(participantEscapeMeta, eq(participantEscapeMeta.participantId, participants.id))
      .where(and(eq(participants.programId, programId), eq(participants.status, "ACTIVE"))),
  ]);

  const workers = workerRows.map((row) => ({
    participantId: row.participantId,
    name: row.name,
    groupName: row.groupName ?? "미배정",
    demandSiteId: row.demandSiteId,
    demandSiteName: row.demandSiteName ?? "수요처 미배정",
    lat: row.lat,
    lng: row.lng,
    lastLocationAt: row.lastLocationAt,
    alertCount: row.alertCount ?? 0,
    status: row.outsideStart ? ("ESCAPE" as const) : ("NORMAL" as const),
  }));

  return c.json({ openEscapes: openEscapeRows, openSosEvents: openSosRows, workers });
});

export default app;
