import type { Context, Next } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

import { admins } from "../db/schema";
import { verifyAccessJwt } from "./cfAccess";
import type { AdminRole, AdminSession, Env } from "../types";

const parseIdArray = (raw: string | null): number[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "number") : [];
  } catch {
    return [];
  }
};

// /api/* 앞단에 걸어서 CF-Access-JWT-Assertion을 검증하고, 이메일로 admins를 조회해
// c.set("admin", ...) 해둔다. Cloudflare Access 자체가 이 경로를 보호하고 있어야 하며,
// 여기서는 헤더를 그대로 믿지 않고 JWKS로 서명을 다시 검증한다 (cfAccess.ts 참고).
export const requireAdmin = async (c: Context<Env>, next: Next) => {
  const token = c.req.header("CF-Access-JWT-Assertion");
  if (!token) {
    return c.json({ error: "인증 토큰이 없습니다." }, 401);
  }

  const email = await verifyAccessJwt(
    token,
    c.env.CF_ACCESS_TEAM_DOMAIN,
    c.env.CF_ACCESS_AUD,
  );
  if (!email) {
    return c.json({ error: "유효하지 않은 인증 토큰입니다." }, 401);
  }

  const db = drizzle(c.env.DB);
  const rows = await db.select().from(admins).where(eq(admins.email, email));
  const admin = rows[0];
  if (!admin) {
    return c.json({ error: "등록되지 않은 관리자입니다." }, 403);
  }

  const session: AdminSession = {
    id: admin.id,
    email,
    role: admin.role,
    organizationId: admin.organizationId,
    projectIds: parseIdArray(admin.projectIds),
    groupIds: parseIdArray(admin.groupIds),
  };
  c.set("admin", session);
  await next();
};

export const getAuth = (c: Context<Env>): AdminSession => c.get("admin");

const ROLE_LEVELS: Record<AdminRole, number> = {
  SUPER_ADMIN: 4,
  AGENCY_ADMIN: 3,
  SUB_ADMIN: 2,
  MANAGER: 1,
};

export const hasMinRole = (admin: AdminSession, required: AdminRole): boolean =>
  ROLE_LEVELS[admin.role] >= ROLE_LEVELS[required];

// 기관 단위 접근: SUPER_ADMIN은 전체, 나머지는 소속 기관만
export const canAccessOrg = (admin: AdminSession, organizationId: number): boolean =>
  admin.role === "SUPER_ADMIN" || admin.organizationId === organizationId;

// 사업단 단위 접근: 기관 소속이면 통과, MANAGER는 담당 사업단(projectIds)만
export const canAccessProgram = (
  admin: AdminSession,
  program: { organizationId: number; id: number },
): boolean => {
  if (admin.role === "SUPER_ADMIN") return true;
  if (admin.role === "MANAGER") return admin.projectIds.includes(program.id);
  return admin.organizationId === program.organizationId;
};

// 조 단위 접근: 기관/사업단 담당이면 통과, SUB_ADMIN은 담당 조(groupIds)만
export const canAccessGroup = (
  admin: AdminSession,
  group: { id: number; programId: number },
  program: { organizationId: number; id: number },
): boolean => {
  if (admin.role === "SUB_ADMIN") return admin.groupIds.includes(group.id);
  return canAccessProgram(admin, program);
};
