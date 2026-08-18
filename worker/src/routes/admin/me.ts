import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";

import type { Env } from "../../types";

import { admins, adminSessions } from "../../db/schema";
import { getAuth } from "../../lib/authz";
import { hashPassword, verifyPassword } from "../../lib/password";
import {
  clearPasswordChangeFailures,
  isPasswordChangeLocked,
  recordPasswordChangeFailure,
} from "../../lib/passwordChangeRateLimit";
import {
  getSessionCookieAttrs,
  hashSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from "../../lib/sessionToken";

const app = new Hono<Env>();

app.get("/", (c) => c.json(getAuth(c)));

// requireAdmin을 이미 통과했으니(만료 안 됨) 여기선 만료시각만 다시 뒤로 늘린다 —
// 세션 만료 임박 배너의 "연장하기" 버튼에서 호출한다. sliding expiration이 아니라
// 이 요청을 명시적으로 호출했을 때만 늘어난다(매 API 요청마다 자동 연장 안 함).
app.post("/extend-session", async (c) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (!token) return c.json({ error: "로그인이 필요합니다." }, 401);

  const db = drizzle(c.env.DB);
  const tokenHash = await hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db
    .update(adminSessions)
    .set({ expiresAt: expiresAt.toISOString() })
    .where(eq(adminSessions.tokenHash, tokenHash));

  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    ...getSessionCookieAttrs(c.req.url),
    path: "/",
    expires: expiresAt,
  });

  return c.json({ expiresAt: expiresAt.toISOString() });
});

// 본인 비밀번호 변경 — 관리자 계정 CRUD(PUT /api/admins/:id)와 별개로, 남의 비밀번호는
// 아무도(SUPER_ADMIN 포함) 바꿀 수 없고 본인만 바꿀 수 있다.
app.put("/password", async (c) => {
  const auth = getAuth(c);
  const body = await c.req.json<{
    currentPassword?: string;
    newPassword?: string;
  }>();

  if (!body.currentPassword || !body.newPassword) {
    return c.json({ error: "현재 비밀번호와 새 비밀번호를 입력해주세요." }, 400);
  }
  if (body.newPassword.length < 8) {
    return c.json({ error: "새 비밀번호는 8자 이상이어야 합니다." }, 400);
  }

  const db = drizzle(c.env.DB);

  if (await isPasswordChangeLocked(db, auth.id)) {
    return c.json({ error: "시도가 너무 많습니다. 15분 후 다시 시도해주세요." }, 429);
  }

  const rows = await db.select().from(admins).where(eq(admins.id, auth.id));
  const admin = rows[0];
  if (!admin?.passwordHash) {
    return c.json({ error: "계정을 찾을 수 없습니다." }, 404);
  }

  const valid = await verifyPassword(body.currentPassword, admin.passwordHash);
  if (!valid) {
    await recordPasswordChangeFailure(db, auth.id);
    return c.json({ error: "현재 비밀번호가 올바르지 않습니다." }, 401);
  }

  await clearPasswordChangeFailures(db, auth.id);

  const passwordHash = await hashPassword(body.newPassword);
  await db.update(admins).set({ passwordHash }).where(eq(admins.id, auth.id));

  return c.json({ ok: true });
});

export default app;
