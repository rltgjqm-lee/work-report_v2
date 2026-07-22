import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

import { admins } from "../db/schema";
import { getAuth } from "../lib/authz";
import { hashPassword, verifyPassword } from "../lib/password";
import {
  isPasswordChangeLocked,
  recordPasswordChangeFailure,
  clearPasswordChangeFailures,
} from "../lib/passwordChangeRateLimit";
import type { Env } from "../types";

const app = new Hono<Env>();

app.get("/", (c) => c.json(getAuth(c)));

// 본인 비밀번호 변경 — 관리자 계정 CRUD(PUT /api/admins/:id)와 별개로, 남의 비밀번호는
// 아무도(SUPER_ADMIN 포함) 바꿀 수 없고 본인만 바꿀 수 있다.
app.put("/password", async (c) => {
  const auth = getAuth(c);
  const body = await c.req.json<{
    currentPassword?: string;
    newPassword?: string;
  }>();

  if (!body.currentPassword || !body.newPassword) {
    return c.json({ error: "currentPassword, newPassword are required" }, 400);
  }
  if (body.newPassword.length < 8) {
    return c.json({ error: "새 비밀번호는 8자 이상이어야 합니다." }, 400);
  }

  const db = drizzle(c.env.DB);

  if (await isPasswordChangeLocked(db, auth.id)) {
    return c.json(
      { error: "시도가 너무 많습니다. 15분 후 다시 시도해주세요." },
      429,
    );
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
