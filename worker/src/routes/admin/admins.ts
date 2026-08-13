import { and, desc, eq, getTableColumns, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

import { ROLES, type AdminRole, type Env } from "../../types";

import {
  adminLoginHistory,
  admins,
  adminSessions,
  demandSites,
  organizations,
} from "../../db/schema";
import { getAuth, parseIdArray } from "../../lib/authz";
import { hashPassword } from "../../lib/password";
import { tryConsumePasswordResetBudget } from "../../lib/passwordResetRateLimit";

const app = new Hono<Env>();

// 관리자 계정 생성 권한: SUPER_ADMIN은 전체, ORGANIZATION_ADMIN은 자기 기관 내
// SUB_ADMIN/MANAGER만 발급 가능 (설계도 2장 권한 매트릭스 기준)
const ASSIGNABLE_ROLES: Record<AdminRole, AdminRole[]> = {
  [ROLES.SUPER_ADMIN]: [
    ROLES.SUPER_ADMIN,
    ROLES.ORGANIZATION_ADMIN,
    ROLES.SUB_ADMIN,
    ROLES.MANAGER,
  ],
  [ROLES.ORGANIZATION_ADMIN]: [ROLES.SUB_ADMIN, ROLES.MANAGER],
  [ROLES.SUB_ADMIN]: [],
  [ROLES.MANAGER]: [],
};

const toAdminJson = (admin: typeof admins.$inferSelect) => ({
  id: admin.id,
  email: admin.email,
  name: admin.name,
  role: admin.role,
  organizationId: admin.organizationId,
  programIds: parseIdArray(admin.programIds),
  groupIds: parseIdArray(admin.groupIds),
  isActive: admin.isActive,
  createdAt: admin.createdAt,
});

// 목록 화면(관리자 계정)에서 기관명을 프론트가 매 행마다 find로 찾지 않도록 서버에서
// organizations를 조인해 같이 내려준다.
const toAdminListJson = (
  admin: typeof admins.$inferSelect & { organizationName: string | null },
) => ({
  ...toAdminJson(admin),
  organizationName: admin.organizationName,
});

type AdminBody = {
  email?: string;
  name?: string;
  role?: AdminRole;
  organizationId?: number;
  programIds?: number[];
  groupIds?: number[];
  isActive?: boolean;
  // 계정 발급 시(POST)에만 쓰임 — 발급자가 임시 비밀번호를 정해주고, 본인이 로그인 후
  // PUT /api/me/password로 바꾼다. 수정(PUT)에서는 본인 외 아무도 비밀번호를 못 바꾼다.
  password?: string;
};

app.get("/", async (c) => {
  const auth = getAuth(c);
  if (ASSIGNABLE_ROLES[auth.role].length === 0) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const db = drizzle(c.env.DB);
  const selectWithOrganizationName = db
    .select({ ...getTableColumns(admins), organizationName: organizations.name })
    .from(admins)
    .leftJoin(organizations, eq(admins.organizationId, organizations.id));
  const rows =
    auth.role === ROLES.SUPER_ADMIN
      ? await selectWithOrganizationName
      : await selectWithOrganizationName.where(
          eq(admins.organizationId, auth.organizationId as number),
        );

  return c.json(rows.map(toAdminListJson));
});

app.post("/", async (c) => {
  const auth = getAuth(c);
  const assignable = ASSIGNABLE_ROLES[auth.role];
  if (assignable.length === 0) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const body = await c.req.json<AdminBody>();
  if (!body.email || !body.name || !body.role || !body.password) {
    return c.json({ error: "이메일, 이름, 역할, 비밀번호를 모두 입력해주세요." }, 400);
  }
  if (body.password.length < 8) {
    return c.json({ error: "비밀번호는 8자 이상이어야 합니다." }, 400);
  }
  if (!assignable.includes(body.role)) {
    return c.json({ error: "이 역할의 계정을 발급할 권한이 없습니다." }, 403);
  }

  const organizationId =
    auth.role === ROLES.SUPER_ADMIN ? (body.organizationId ?? null) : auth.organizationId;
  if (body.role !== ROLES.SUPER_ADMIN && !organizationId) {
    return c.json({ error: "소속 기관을 선택해주세요." }, 400);
  }

  const passwordHash = await hashPassword(body.password);
  // 로그인(auth.ts)이 이메일을 소문자로 정규화해서 조회하므로, 저장할 때도 똑같이
  // 정규화해야 대소문자가 다르게 입력됐을 때 로그인이 막히는 걸 방지한다.
  const email = body.email.trim().toLowerCase();

  const db = drizzle(c.env.DB);

  // 이메일이 곧 로그인 아이디(unique 컬럼)라, 중복이면 D1이 UNIQUE 제약 오류를 던지고
  // 그대로 두면 500이 나간다. 발급하는 사람이 바로 알아볼 수 있게 409로 돌려준다.
  const duplicateRows = await db
    .select({ id: admins.id })
    .from(admins)
    .where(eq(admins.email, email));
  if (duplicateRows[0]) {
    return c.json({ error: "이미 등록된 이메일입니다." }, 409);
  }

  let result;
  try {
    result = await db
      .insert(admins)
      .values({
        email,
        name: body.name,
        role: body.role,
        organizationId,
        programIds: body.programIds ? JSON.stringify(body.programIds) : null,
        groupIds: body.groupIds ? JSON.stringify(body.groupIds) : null,
        passwordHash,
      })
      .returning();
  } catch (error) {
    // 위 조회와 insert 사이에 같은 이메일이 먼저 들어간 경우 — 제약 오류만 409로 바꾸고
    // 나머지는 그대로 올려보낸다.
    if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
      return c.json({ error: "이미 등록된 이메일입니다." }, 409);
    }
    throw error;
  }

  return c.json(toAdminJson(result[0]), 201);
});

// 담당 이관 — 퇴사 등으로 담당자를 정리할 때, 담당 사업단들을 (한 사람에게 몰아주거나 여러
// 사람에게 나눠) 다른 담당자들에게 넘긴다. 사업단마다 다른 담당자를 배정할 수 있다.
// 사업단(programIds)만 옮기면 그 사업단 수요처에는 떠난 사람이 담당자로 남으므로 함께 갱신한다.
app.put("/:id/transfer-programs", async (c) => {
  const auth = getAuth(c);
  if (ASSIGNABLE_ROLES[auth.role].length === 0) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));
  const fromRows = await db.select().from(admins).where(eq(admins.id, id));
  const from = fromRows[0];
  if (!from) return c.json({ error: "관리자 계정을 찾을 수 없습니다." }, 404);
  if (auth.role !== ROLES.SUPER_ADMIN && from.organizationId !== auth.organizationId) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }
  if (from.organizationId === null) {
    return c.json({ error: "소속 기관이 없는 계정은 이관할 수 없습니다." }, 400);
  }

  const body = await c.req.json<{ assignments?: { programId: number; toAdminId: number }[] }>();
  const assignments = body.assignments ?? [];
  if (assignments.length === 0) {
    return c.json({ error: "이관할 사업단과 담당자를 선택해주세요." }, 400);
  }
  if (assignments.some((assignment) => assignment.toAdminId === id)) {
    return c.json({ error: "같은 계정으로는 이관할 수 없습니다." }, 400);
  }

  const fromProgramIds = parseIdArray(from.programIds);
  const assignedProgramIds = assignments.map((assignment) => assignment.programId);
  // 일부만 배정하고 나머지를 빠뜨리면 from에 사업단이 남아 비활성화가 막히는 상태가
  // 되므로, 담당하던 사업단 전부가 정확히 한 번씩 배정됐는지 검증한다.
  const isExactAssignment =
    assignedProgramIds.length === fromProgramIds.length &&
    fromProgramIds.every((programId) => assignedProgramIds.includes(programId));
  if (!isExactAssignment) {
    return c.json({ error: "담당하던 사업단을 빠짐없이 배정해주세요." }, 400);
  }

  const managerCandidates = await db
    .select({ id: admins.id, programIds: admins.programIds, isActive: admins.isActive })
    .from(admins)
    .where(
      and(
        eq(admins.organizationId, from.organizationId),
        inArray(admins.role, [ROLES.MANAGER, ROLES.SUB_ADMIN]),
      ),
    );

  const toAdminIds = [...new Set(assignments.map((assignment) => assignment.toAdminId))];
  for (const toAdminId of toAdminIds) {
    const candidate = managerCandidates.find(
      (managerCandidate) => managerCandidate.id === toAdminId,
    );
    if (!candidate) return c.json({ error: "이관받을 계정을 찾을 수 없습니다." }, 404);
    if (!candidate.isActive) return c.json({ error: "비활성 계정으로는 이관할 수 없습니다." }, 400);
  }

  const programIdToAdminId = new Map(
    assignments.map((assignment) => [assignment.programId, assignment.toAdminId]),
  );
  const reassignedProgramIds = new Set(programIdToAdminId.keys());

  const managerUpdates = managerCandidates.flatMap((candidate) => {
    const currentProgramIds = parseIdArray(candidate.programIds);
    const keep = currentProgramIds.filter((programId) => !reassignedProgramIds.has(programId));
    const gained = [...reassignedProgramIds].filter(
      (programId) => programIdToAdminId.get(programId) === candidate.id,
    );
    const nextProgramIds = [...new Set([...keep, ...gained])];

    const unchanged =
      nextProgramIds.length === currentProgramIds.length &&
      nextProgramIds.every((programId) => currentProgramIds.includes(programId));
    if (unchanged) return [];

    return [
      db
        .update(admins)
        .set({ programIds: JSON.stringify(nextProgramIds) })
        .where(eq(admins.id, candidate.id)),
    ];
  });

  // 사업단 담당자 변경과 같은 규칙 — 그 사업단의 수요처 담당자는 사업단 담당자를 따라간다.
  // 모든 갱신은 하나로 묶어서 보낸다(D1 batch = 단일 트랜잭션) — 중간에 실패해서 일부
  // 사업단만 넘어가고 수요처엔 떠난 사람이 남는 어긋난 상태가 생기면 관제까지 영향이 간다.
  const demandSiteUpdates = assignments.map(({ programId, toAdminId }) =>
    db
      .update(demandSites)
      .set({ contactAdminId: toAdminId })
      .where(eq(demandSites.programId, programId))
      .returning({ id: demandSites.id }),
  );

  // db.batch()는 최소 1개짜리 튜플 타입을 요구해서, 항상 1개 이상 있는 demandSiteUpdates의
  // 첫 원소를 명시적으로 꺼내 타입을 맞춘다.
  const results = await db.batch([
    demandSiteUpdates[0],
    ...demandSiteUpdates.slice(1),
    ...managerUpdates,
  ]);
  const demandSiteCount = results
    .slice(0, demandSiteUpdates.length)
    .reduce((sum, result) => sum + (Array.isArray(result) ? result.length : 0), 0);

  return c.json({
    ok: true,
    programCount: assignedProgramIds.length,
    demandSiteCount,
  });
});

app.put("/:id", async (c) => {
  const auth = getAuth(c);
  const assignable = ASSIGNABLE_ROLES[auth.role];
  if (assignable.length === 0) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));
  const existingRows = await db.select().from(admins).where(eq(admins.id, id));
  const existing = existingRows[0];
  if (!existing) return c.json({ error: "관리자 계정을 찾을 수 없습니다." }, 404);
  if (auth.role !== ROLES.SUPER_ADMIN && existing.organizationId !== auth.organizationId) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const body = await c.req.json<AdminBody>();
  if (body.role && body.role !== existing.role && !assignable.includes(body.role)) {
    return c.json({ error: "이 역할로 변경할 권한이 없습니다." }, 403);
  }

  // 담당 사업단을 들고 있는 계정을 그냥 비활성화하면, 그 사업단과 수요처에 떠난 사람이
  // 담당자로 남는다 — 이관을 먼저 하도록 막는다.
  if (
    body.isActive === false &&
    existing.isActive &&
    parseIdArray(existing.programIds).length > 0
  ) {
    return c.json(
      {
        error: "담당 사업단이 남아 있습니다. 담당 이관을 먼저 진행한 뒤 비활성화해주세요.",
      },
      400,
    );
  }

  const result = await db
    .update(admins)
    .set({
      name: body.name ?? existing.name,
      role: body.role ?? existing.role,
      programIds:
        body.programIds !== undefined ? JSON.stringify(body.programIds) : existing.programIds,
      groupIds: body.groupIds !== undefined ? JSON.stringify(body.groupIds) : existing.groupIds,
      isActive: body.isActive ?? existing.isActive,
    })
    .where(eq(admins.id, id))
    .returning();

  return c.json(toAdminJson(result[0]));
});

// 남의 비밀번호 재설정 — 이메일 재설정 플로우가 없어서, 비밀번호를 잊어버린 계정은
// 발급 권한이 있는 관리자(SUPER_ADMIN 전체, ORGANIZATION_ADMIN은 자기 기관 내)가
// 대신 새 비밀번호를 정해준다. 현재 비밀번호 확인 없이 강제로 바꾸는 것이므로,
// 재설정 후 그 계정의 기존 세션을 전부 끊어서(로그아웃) 안전하게 만든다.
app.put("/:id/password", async (c) => {
  const auth = getAuth(c);
  const assignable = ASSIGNABLE_ROLES[auth.role];
  if (assignable.length === 0) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const db = drizzle(c.env.DB);

  if (!(await tryConsumePasswordResetBudget(db, auth.id))) {
    return c.json({ error: "재설정 요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, 429);
  }

  const id = Number(c.req.param("id"));
  const existingRows = await db.select().from(admins).where(eq(admins.id, id));
  const existing = existingRows[0];
  if (!existing) return c.json({ error: "관리자 계정을 찾을 수 없습니다." }, 404);
  if (auth.role !== ROLES.SUPER_ADMIN && existing.organizationId !== auth.organizationId) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const body = await c.req.json<{ newPassword?: string }>();
  if (!body.newPassword || body.newPassword.length < 8) {
    return c.json({ error: "새 비밀번호는 8자 이상이어야 합니다." }, 400);
  }

  const passwordHash = await hashPassword(body.newPassword);
  await db.update(admins).set({ passwordHash }).where(eq(admins.id, id));
  await db.delete(adminSessions).where(eq(adminSessions.adminId, id));

  return c.json({ ok: true });
});

// 로그인 시도 이력 조회 — IP/성공여부까지 보이는 민감 정보라 SUPER_ADMIN 전용.
app.get("/login-history", async (c) => {
  const auth = getAuth(c);
  if (auth.role !== ROLES.SUPER_ADMIN) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const db = drizzle(c.env.DB);
  const rows = await db
    .select({
      id: adminLoginHistory.id,
      email: adminLoginHistory.email,
      adminName: admins.name,
      success: adminLoginHistory.success,
      ipAddress: adminLoginHistory.ipAddress,
      createdAt: adminLoginHistory.createdAt,
    })
    .from(adminLoginHistory)
    .leftJoin(admins, eq(adminLoginHistory.adminId, admins.id))
    .orderBy(desc(adminLoginHistory.createdAt))
    .limit(200);

  return c.json(rows);
});

export default app;
