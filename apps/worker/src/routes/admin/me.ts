import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";

import type { Env } from "../../types";

import { adminDevices, adminPushSubscriptions, admins, adminSessions } from "../../db/schema";
import { revokeAdminAccess } from "../../lib/adminAppTokens";
import { getAuth, readSessionToken } from "../../lib/authz";
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

  // 비밀번호를 바꾸는 건 보통 누가 내 계정을 쓰는 것 같을 때라, 다른 PC 세션과 앱 로그인은
  // 전부 끊는다. 지금 비밀번호를 바꾼 이 화면의 세션 하나만 남긴다.
  const currentToken = readSessionToken(c);
  await revokeAdminAccess(db, auth.id, {
    keepSessionTokenHash: currentToken ? await hashSessionToken(currentToken) : undefined,
  });

  return c.json({ ok: true });
});

// 관리자 콘솔(admin.worksafe.co.kr 서비스워커)의 웹 푸시 구독 등록 — SOS 발생 시
// /public/sos가 이 구독으로 알림을 보낸다. endpoint가 unique라 같은 브라우저가 다시
// 구독해도 upsert로 처리된다.
app.post("/push-subscriptions", async (c) => {
  const auth = getAuth(c);
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  }>();

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return c.json({ error: "푸시 구독 정보가 올바르지 않습니다." }, 400);
  }

  const result = await db
    .insert(adminPushSubscriptions)
    .values({
      adminId: auth.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    })
    .onConflictDoUpdate({
      target: adminPushSubscriptions.endpoint,
      set: { adminId: auth.id, p256dh: body.keys.p256dh, auth: body.keys.auth },
    })
    .returning();

  return c.json(result[0], 201);
});

// 알림을 끄거나 로그아웃할 때 구독을 정리한다.
app.delete("/push-subscriptions", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json<{ endpoint?: string }>();
  if (!body.endpoint) {
    return c.json({ error: "endpoint를 지정해주세요." }, 400);
  }

  await db.delete(adminPushSubscriptions).where(eq(adminPushSubscriptions.endpoint, body.endpoint));

  return c.json({ ok: true });
});

// 관리자 앱(Android)의 FCM 토큰 등록 — SOS 발생 시 PC 웹 푸시와 별도로 이 폰에도 보낸다.
// 같은 폰(같은 토큰)으로 다른 관리자가 로그인하면 그 관리자에게로 옮긴다.
app.post("/devices", async (c) => {
  const auth = getAuth(c);
  const body = await c.req.json<{ fcmToken?: string }>();
  if (!body.fcmToken) {
    return c.json({ error: "FCM 토큰이 없습니다." }, 400);
  }

  const db = drizzle(c.env.DB);
  const nowIso = new Date().toISOString();
  await db
    .insert(adminDevices)
    .values({ adminId: auth.id, fcmToken: body.fcmToken, updatedAt: nowIso })
    .onConflictDoUpdate({
      target: adminDevices.fcmToken,
      set: { adminId: auth.id, updatedAt: nowIso },
    });

  return c.json({ ok: true }, 201);
});

// 앱에서 알림을 끌 때 FCM 토큰을 지운다(로그아웃은 /auth/app/logout이 같이 지운다).
app.delete("/devices", async (c) => {
  const auth = getAuth(c);
  const body = await c.req.json<{ fcmToken?: string }>();
  if (!body.fcmToken) {
    return c.json({ error: "FCM 토큰이 없습니다." }, 400);
  }

  const db = drizzle(c.env.DB);
  await db
    .delete(adminDevices)
    .where(and(eq(adminDevices.fcmToken, body.fcmToken), eq(adminDevices.adminId, auth.id)));

  return c.json({ ok: true });
});

export default app;
