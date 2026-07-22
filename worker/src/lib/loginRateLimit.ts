import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

import { adminLoginAttempts } from "../db/schema";

// 5회 연속 실패하면 15분 잠금 — 무차별 대입 방지. 성공하면 즉시 초기화된다.
const MAX_FAIL_COUNT = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

type DB = ReturnType<typeof drizzle>;

// 잠겨 있으면 true. 잠금 만료 시각이 지났으면 다시 시도 가능하다고 본다
// (row는 로그인 성공/실패 시점에 정리되므로 여기서 지우지는 않는다).
export const isLoginLocked = async (
  db: DB,
  email: string,
): Promise<boolean> => {
  const rows = await db
    .select()
    .from(adminLoginAttempts)
    .where(eq(adminLoginAttempts.email, email));
  const row = rows[0];
  if (!row?.lockedUntil) return false;
  return new Date(row.lockedUntil).getTime() > Date.now();
};

export const recordLoginFailure = async (
  db: DB,
  email: string,
): Promise<void> => {
  const rows = await db
    .select()
    .from(adminLoginAttempts)
    .where(eq(adminLoginAttempts.email, email));
  const row = rows[0];
  const failCount = (row?.failCount ?? 0) + 1;
  const lockedUntil =
    failCount >= MAX_FAIL_COUNT
      ? new Date(Date.now() + LOCKOUT_MS).toISOString()
      : null;

  if (row) {
    await db
      .update(adminLoginAttempts)
      .set({ failCount, lockedUntil, updatedAt: new Date().toISOString() })
      .where(eq(adminLoginAttempts.email, email));
  } else {
    await db
      .insert(adminLoginAttempts)
      .values({ email, failCount, lockedUntil });
  }
};

export const clearLoginFailures = async (
  db: DB,
  email: string,
): Promise<void> => {
  await db
    .delete(adminLoginAttempts)
    .where(eq(adminLoginAttempts.email, email));
};
