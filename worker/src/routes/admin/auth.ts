import { and, eq, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import type { Env } from "../../types";

import { admins, adminSessions } from "../../db/schema";
import { sendEmail } from "../../lib/email";
import { recordLoginHistory } from "../../lib/loginHistory";
import { clearLoginFailures, isLoginLocked, recordLoginFailure } from "../../lib/loginRateLimit";
import { hashPassword, verifyPassword } from "../../lib/password";
import { tryConsumePasswordResetRequestBudget } from "../../lib/passwordResetRequestRateLimit";
import {
  generateSessionToken,
  getSessionCookieAttrs,
  hashSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from "../../lib/sessionToken";

// 세션 토큰과 동일한 "256비트 랜덤 + SHA-256 해시" 방식을 재설정 토큰에도 그대로 쓴다
// (원문은 이메일로만 나가고 DB엔 해시만 남는다).
const generateResetToken = generateSessionToken;
const hashResetToken = hashSessionToken;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30분

const app = new Hono<Env>();

// 이메일+비밀번호 로그인. 실패 사유(계정 없음/비밀번호 오류/비활성 계정)를 구분해서
// 응답하지 않는다 — 계정 존재 여부를 외부에 노출하지 않기 위함.
const INVALID_CREDENTIALS_MESSAGE = "이메일 또는 비밀번호가 올바르지 않습니다.";

app.post("/login", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();
  if (!body.email || !body.password) {
    return c.json({ error: "이메일과 비밀번호를 입력해주세요." }, 400);
  }
  const email = body.email.trim().toLowerCase();
  const ipAddress = c.req.header("CF-Connecting-IP") ?? null;

  const db = drizzle(c.env.DB);

  if (await isLoginLocked(db, email)) {
    return c.json({ error: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요." }, 429);
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
    await db.delete(adminSessions).where(eq(adminSessions.tokenHash, tokenHash));
  }

  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: "/",
    ...getSessionCookieAttrs(c.req.url),
  });
  return c.json({ ok: true });
});

// 비로그인 상태에서 이메일로 재설정 링크를 요청한다. 계정 존재 여부가 응답으로
// 새어나가면 안 되므로, 이메일이 없거나 비활성 계정이어도 항상 같은 성공 응답을 준다.
app.post("/forgot-password", async (c) => {
  const body = await c.req.json<{ email?: string }>();
  if (!body.email) {
    return c.json({ error: "이메일을 입력해주세요." }, 400);
  }
  const email = body.email.trim().toLowerCase();

  const db = drizzle(c.env.DB);

  if (!(await tryConsumePasswordResetRequestBudget(db, email))) {
    return c.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, 429);
  }

  const rows = await db.select().from(admins).where(eq(admins.email, email));
  const admin = rows[0];

  if (admin && admin.isActive) {
    const token = generateResetToken();
    const tokenHash = await hashResetToken(token);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await db
      .update(admins)
      .set({ resetTokenHash: tokenHash, resetTokenExpiresAt: expiresAt.toISOString() })
      .where(eq(admins.id, admin.id));

    const resetUrl = `${c.env.ADMIN_APP_URL}/admin/reset-password?token=${token}`;
    await sendEmail(c.env.RESEND_API_KEY, {
      from: c.env.RESEND_FROM_EMAIL,
      to: email,
      subject: "[워크 세이프] 비밀번호 재설정 안내",
      html: `
        <p>비밀번호 재설정을 요청하셨습니다. 아래 링크를 눌러 새 비밀번호를 설정해주세요.</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>이 링크는 30분간만 유효합니다. 본인이 요청하지 않았다면 이 메일을 무시해주세요.</p>
      `,
    });
  }

  return c.json({ ok: true });
});

// 이메일로 받은 토큰으로 새 비밀번호를 설정한다.
app.post("/reset-password", async (c) => {
  const body = await c.req.json<{ token?: string; newPassword?: string }>();
  if (!body.token || !body.newPassword) {
    return c.json({ error: "토큰과 새 비밀번호를 입력해주세요." }, 400);
  }
  if (body.newPassword.length < 8) {
    return c.json({ error: "새 비밀번호는 8자 이상이어야 합니다." }, 400);
  }

  const db = drizzle(c.env.DB);
  const tokenHash = await hashResetToken(body.token);
  const now = new Date().toISOString();

  const rows = await db
    .select()
    .from(admins)
    .where(and(eq(admins.resetTokenHash, tokenHash), gt(admins.resetTokenExpiresAt, now)));
  const admin = rows[0];
  if (!admin) {
    return c.json({ error: "재설정 링크가 유효하지 않거나 만료되었습니다." }, 400);
  }

  const passwordHash = await hashPassword(body.newPassword);
  await db
    .update(admins)
    .set({ passwordHash, resetTokenHash: null, resetTokenExpiresAt: null })
    .where(eq(admins.id, admin.id));
  // 재설정하면 탈취된 기존 세션도 전부 끊는다(관리자가 남을 재설정할 때와 동일한 정책).
  await db.delete(adminSessions).where(eq(adminSessions.adminId, admin.id));

  return c.json({ ok: true });
});

export default app;
