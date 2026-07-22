import { Hono } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

import { admins, adminSessions } from "../db/schema";
import { verifyPassword } from "../lib/password";
import {
  generateSessionToken,
  hashSessionToken,
  getSessionCookieAttrs,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from "../lib/sessionToken";
import {
  isLoginLocked,
  recordLoginFailure,
  clearLoginFailures,
} from "../lib/loginRateLimit";
import { recordLoginHistory } from "../lib/loginHistory";
import type { Env } from "../types";

const app = new Hono<Env>();

// 이메일+비밀번호 로그인. 실패 사유(계정 없음/비밀번호 오류/비활성 계정)를 구분해서
// 응답하지 않는다 — 계정 존재 여부를 외부에 노출하지 않기 위함.
const INVALID_CREDENTIALS_MESSAGE = "이메일 또는 비밀번호가 올바르지 않습니다.";

app.post("/login", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();
  if (!body.email || !body.password) {
    return c.json({ error: "email, password are required" }, 400);
  }
  const email = body.email.trim().toLowerCase();
  const ipAddress = c.req.header("CF-Connecting-IP") ?? null;

  const db = drizzle(c.env.DB);

  if (await isLoginLocked(db, email)) {
    return c.json(
      { error: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요." },
      429,
    );
  }

  const rows = await db.select().from(admins).where(eq(admins.email, email));
  const admin = rows[0];

  if (!admin || !admin.passwordHash || !admin.isActive) {
    await recordLoginFailure(db, email);
    await recordLoginHistory(db, {
      adminId: admin?.id ?? null,
      email,
      success: false,
      ipAddress,
    });
    return c.json({ error: INVALID_CREDENTIALS_MESSAGE }, 401);
  }

  const valid = await verifyPassword(body.password, admin.passwordHash);
  if (!valid) {
    await recordLoginFailure(db, email);
    await recordLoginHistory(db, {
      adminId: admin.id,
      email,
      success: false,
      ipAddress,
    });
    return c.json({ error: INVALID_CREDENTIALS_MESSAGE }, 401);
  }

  await clearLoginFailures(db, email);
  await recordLoginHistory(db, {
    adminId: admin.id,
    email,
    success: true,
    ipAddress,
  });

  const token = generateSessionToken();
  const tokenHash = await hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(adminSessions).values({
    adminId: admin.id,
    tokenHash,
    expiresAt: expiresAt.toISOString(),
  });

  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    ...getSessionCookieAttrs(c.req.url),
    path: "/",
    expires: expiresAt,
  });

  return c.json({ ok: true });
});

app.post("/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);

  if (token) {
    const db = drizzle(c.env.DB);
    const tokenHash = await hashSessionToken(token);
    await db
      .delete(adminSessions)
      .where(eq(adminSessions.tokenHash, tokenHash));
  }

  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: "/",
    ...getSessionCookieAttrs(c.req.url),
  });
  return c.json({ ok: true });
});

export default app;
