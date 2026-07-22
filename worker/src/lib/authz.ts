import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, gt } from "drizzle-orm";

import { admins, adminSessions } from "../db/schema";
import { hashSessionToken, SESSION_COOKIE_NAME } from "./sessionToken";
import { ROLES, type AdminRole, type AdminSession, type Env } from "../types";

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

// /api/* 앞단에 걸어서 세션 쿠키를 검증하고, 연결된 관리자를 조회해 c.set("admin", ...)
// 해둔다. 쿠키엔 원문 토큰만 있고 DB엔 해시만 있으므로 여기서 해시를 다시 계산해 대조한다.
export const requireAdmin = async (c: Context<Env>, next: Next) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (!token) {
    return c.json({ error: "로그인이 필요합니다." }, 401);
  }

  const db = drizzle(c.env.DB);
  const tokenHash = await hashSessionToken(token);

  const sessionRows = await db
    .select({ adminId: adminSessions.adminId })
    .from(adminSessions)
    .where(
      and(
        eq(adminSessions.tokenHash, tokenHash),
        gt(adminSessions.expiresAt, new Date().toISOString()),
      ),
    );
  const sessionRow = sessionRows[0];
  if (!sessionRow) {
    return c.json(
      { error: "세션이 만료되었습니다. 다시 로그인해주세요." },
      401,
    );
  }

  const rows = await db
    .select()
    .from(admins)
    .where(eq(admins.id, sessionRow.adminId));
  const admin = rows[0];
  if (!admin) {
    return c.json({ error: "등록되지 않은 관리자입니다." }, 403);
  }
  if (!admin.isActive) {
    return c.json({ error: "비활성화된 관리자 계정입니다." }, 403);
  }

  const session: AdminSession = {
    id: admin.id,
    email: admin.email as string,
    role: admin.role,
    organizationId: admin.organizationId,
    programIds: parseIdArray(admin.programIds),
    groupIds: parseIdArray(admin.groupIds),
  };
  c.set("admin", session);
  await next();
};

export const getAuth = (c: Context<Env>): AdminSession => c.get("admin");

const ROLE_LEVELS: Record<AdminRole, number> = {
  [ROLES.SUPER_ADMIN]: 4,
  [ROLES.ORGANIZATION_ADMIN]: 3,
  [ROLES.SUB_ADMIN]: 2,
  [ROLES.MANAGER]: 1,
};

export const hasMinRole = (admin: AdminSession, required: AdminRole): boolean =>
  ROLE_LEVELS[admin.role] >= ROLE_LEVELS[required];

// 기관 단위 접근: SUPER_ADMIN은 전체, 나머지는 소속 기관만
export const canAccessOrg = (
  admin: AdminSession,
  organizationId: number,
): boolean =>
  admin.role === ROLES.SUPER_ADMIN || admin.organizationId === organizationId;

// 사업단 단위 접근: 기관 소속이면 통과, MANAGER는 담당 사업단(programIds)만
export const canAccessProgram = (
  admin: AdminSession,
  program: { organizationId: number; id: number },
): boolean => {
  if (admin.role === ROLES.SUPER_ADMIN) return true;
  if (admin.role === ROLES.MANAGER)
    return admin.programIds.includes(program.id);
  return admin.organizationId === program.organizationId;
};

// 조 단위 접근: 기관/사업단 담당이면 통과, SUB_ADMIN은 담당 조(groupIds)만
export const canAccessGroup = (
  admin: AdminSession,
  group: { id: number; programId: number },
  program: { organizationId: number; id: number },
): boolean => {
  if (admin.role === ROLES.SUB_ADMIN) return admin.groupIds.includes(group.id);
  return canAccessProgram(admin, program);
};
