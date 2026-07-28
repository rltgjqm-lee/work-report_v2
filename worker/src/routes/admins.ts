import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { desc, eq, inArray } from "drizzle-orm";

import {
  admins,
  adminLoginHistory,
  adminSessions,
  demandSites,
} from "../db/schema";
import { getAuth } from "../lib/authz";
import { hashPassword } from "../lib/password";
import { tryConsumePasswordResetBudget } from "../lib/passwordResetRateLimit";
import { ROLES, type AdminRole, type Env } from "../types";

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

const parseIdArray = (raw: string | null): number[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((v) => typeof v === "number")
      : [];
  } catch {
    return [];
  }
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
  const rows =
    auth.role === ROLES.SUPER_ADMIN
      ? await db.select().from(admins)
      : await db
          .select()
          .from(admins)
          .where(eq(admins.organizationId, auth.organizationId as number));

  return c.json(rows.map(toAdminJson));
});

app.post("/", async (c) => {
  const auth = getAuth(c);
  const assignable = ASSIGNABLE_ROLES[auth.role];
  if (assignable.length === 0) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const body = await c.req.json<AdminBody>();
  if (!body.email || !body.name || !body.role || !body.password) {
    return c.json(
      { error: "이메일, 이름, 역할, 비밀번호를 모두 입력해주세요." },
      400,
    );
  }
  if (body.password.length < 8) {
    return c.json({ error: "비밀번호는 8자 이상이어야 합니다." }, 400);
  }
  if (!assignable.includes(body.role)) {
    return c.json({ error: "이 역할의 계정을 발급할 권한이 없습니다." }, 403);
  }

  const organizationId =
    auth.role === ROLES.SUPER_ADMIN
      ? (body.organizationId ?? null)
      : auth.organizationId;
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

// 담당 이관 — 퇴사 등으로 담당자를 정리할 때, 담당 사업단을 다른 담당자에게 통째로 넘긴다.
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
  if (
    auth.role !== ROLES.SUPER_ADMIN &&
    from.organizationId !== auth.organizationId
  ) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const body = await c.req.json<{ toAdminId?: number }>();
  if (!body.toAdminId) {
    return c.json({ error: "이관받을 담당자를 선택해주세요." }, 400);
  }
  if (body.toAdminId === id) {
    return c.json({ error: "같은 계정으로는 이관할 수 없습니다." }, 400);
  }

  const toRows = await db
    .select()
    .from(admins)
    .where(eq(admins.id, body.toAdminId));
  const to = toRows[0];
  if (!to) return c.json({ error: "이관받을 계정을 찾을 수 없습니다." }, 404);
  if (to.organizationId !== from.organizationId) {
    return c.json({ error: "같은 기관의 계정으로만 이관할 수 있습니다." }, 400);
  }
  if (!to.isActive) {
    return c.json({ error: "비활성 계정으로는 이관할 수 없습니다." }, 400);
  }

  const programIds = parseIdArray(from.programIds);
  if (programIds.length === 0) {
    return c.json({ ok: true, programCount: 0, demandSiteCount: 0 });
  }

  await db
    .update(admins)
    .set({
      programIds: JSON.stringify([
        ...new Set([...parseIdArray(to.programIds), ...programIds]),
      ]),
    })
    .where(eq(admins.id, to.id));

  await db
    .update(admins)
    .set({ programIds: JSON.stringify([]) })
    .where(eq(admins.id, from.id));

  // 사업단 담당자 변경과 같은 규칙 — 그 사업단의 수요처 담당자는 사업단 담당자를 따라간다
  const movedDemandSites = await db
    .update(demandSites)
    .set({ contactAdminId: to.id })
    .where(inArray(demandSites.programId, programIds))
    .returning({ id: demandSites.id });

  return c.json({
    ok: true,
    programCount: programIds.length,
    demandSiteCount: movedDemandSites.length,
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
  if (!existing)
    return c.json({ error: "관리자 계정을 찾을 수 없습니다." }, 404);
  if (
    auth.role !== ROLES.SUPER_ADMIN &&
    existing.organizationId !== auth.organizationId
  ) {
    return c.json({ error: "권한이 없습니다." }, 403);
  }

  const body = await c.req.json<AdminBody>();
  if (
    body.role &&
    body.role !== existing.role &&
    !assignable.includes(body.role)
  ) {
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
        error:
          "담당 사업단이 남아 있습니다. 담당 이관을 먼저 진행한 뒤 비활성화해주세요.",
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
        body.programIds !== undefined
          ? JSON.stringify(body.programIds)
          : existing.programIds,
      groupIds:
        body.groupIds !== undefined
          ? JSON.stringify(body.groupIds)
          : existing.groupIds,
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
    return c.json(
      { error: "재설정 요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      429,
    );
  }

  const id = Number(c.req.param("id"));
  const existingRows = await db.select().from(admins).where(eq(admins.id, id));
  const existing = existingRows[0];
  if (!existing)
    return c.json({ error: "관리자 계정을 찾을 수 없습니다." }, 404);
  if (
    auth.role !== ROLES.SUPER_ADMIN &&
    existing.organizationId !== auth.organizationId
  ) {
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
