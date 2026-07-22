import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

import { adminPasswordChangeAttempts } from "../db/schema";

// 5회 연속 현재 비밀번호를 틀리면 15분 잠금 — loginRateLimit.ts와 동일한 정책.
const MAX_FAIL_COUNT = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

type DB = ReturnType<typeof drizzle>;

export const isPasswordChangeLocked = async (
  db: DB,
  adminId: number,
): Promise<boolean> => {
  const rows = await db
    .select()
    .from(adminPasswordChangeAttempts)
    .where(eq(adminPasswordChangeAttempts.adminId, adminId));
  const row = rows[0];
  if (!row?.lockedUntil) return false;
  return new Date(row.lockedUntil).getTime() > Date.now();
};

export const recordPasswordChangeFailure = async (
  db: DB,
  adminId: number,
): Promise<void> => {
  const rows = await db
    .select()
    .from(adminPasswordChangeAttempts)
    .where(eq(adminPasswordChangeAttempts.adminId, adminId));
  const row = rows[0];
  const failCount = (row?.failCount ?? 0) + 1;
  const lockedUntil =
    failCount >= MAX_FAIL_COUNT
      ? new Date(Date.now() + LOCKOUT_MS).toISOString()
      : null;

  if (row) {
    await db
      .update(adminPasswordChangeAttempts)
      .set({ failCount, lockedUntil, updatedAt: new Date().toISOString() })
      .where(eq(adminPasswordChangeAttempts.adminId, adminId));
  } else {
    await db
      .insert(adminPasswordChangeAttempts)
      .values({ adminId, failCount, lockedUntil });
  }
};

export const clearPasswordChangeFailures = async (
  db: DB,
  adminId: number,
): Promise<void> => {
  await db
    .delete(adminPasswordChangeAttempts)
    .where(eq(adminPasswordChangeAttempts.adminId, adminId));
};
