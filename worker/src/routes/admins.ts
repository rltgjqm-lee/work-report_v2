import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

import { admins } from "../db/schema";
import { getAuth } from "../lib/authz";
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
};

app.get("/", async (c) => {
  const auth = getAuth(c);
  if (ASSIGNABLE_ROLES[auth.role].length === 0) {
    return c.json({ error: "Forbidden" }, 403);
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
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<AdminBody>();
  if (!body.email || !body.name || !body.role) {
    return c.json({ error: "email, name, role are required" }, 400);
  }
  if (!assignable.includes(body.role)) {
    return c.json({ error: "이 역할의 계정을 발급할 권한이 없습니다." }, 403);
  }

  const organizationId =
    auth.role === ROLES.SUPER_ADMIN
      ? (body.organizationId ?? null)
      : auth.organizationId;
  if (body.role !== ROLES.SUPER_ADMIN && !organizationId) {
    return c.json({ error: "organizationId is required" }, 400);
  }

  const db = drizzle(c.env.DB);
  const result = await db
    .insert(admins)
    .values({
      email: body.email,
      name: body.name,
      role: body.role,
      organizationId,
      programIds: body.programIds ? JSON.stringify(body.programIds) : null,
      groupIds: body.groupIds ? JSON.stringify(body.groupIds) : null,
    })
    .returning();

  return c.json(toAdminJson(result[0]), 201);
});

app.put("/:id", async (c) => {
  const auth = getAuth(c);
  const assignable = ASSIGNABLE_ROLES[auth.role];
  if (assignable.length === 0) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));
  const existingRows = await db.select().from(admins).where(eq(admins.id, id));
  const existing = existingRows[0];
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (
    auth.role !== ROLES.SUPER_ADMIN &&
    existing.organizationId !== auth.organizationId
  ) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<AdminBody>();
  if (
    body.role &&
    body.role !== existing.role &&
    !assignable.includes(body.role)
  ) {
    return c.json({ error: "이 역할로 변경할 권한이 없습니다." }, 403);
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

export default app;
