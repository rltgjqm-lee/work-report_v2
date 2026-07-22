import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

import { adminPasswordResetAttempts } from "../db/schema";

// 재설정을 실행하는 관리자(actor) 기준 15분당 20건까지만 허용 — 정상적인 대량
// 온보딩은 통과시키되, 탈취된 세션으로 계정을 무더기로 재설정/잠그는 남용은 막는다.
const MAX_RESETS_PER_WINDOW = 20;
const WINDOW_MS = 15 * 60 * 1000;

type DB = ReturnType<typeof drizzle>;

// 이번 재설정을 허용해도 되면 카운트를 올리고 true, 한도를 넘었으면 카운트를
// 올리지 않고 false를 반환한다.
export const tryConsumePasswordResetBudget = async (
  db: DB,
  actorAdminId: number,
): Promise<boolean> => {
  const rows = await db
    .select()
    .from(adminPasswordResetAttempts)
    .where(eq(adminPasswordResetAttempts.actorAdminId, actorAdminId));
  const row = rows[0];
  const now = Date.now();

  const windowExpired =
    !row || now - new Date(row.windowStart).getTime() > WINDOW_MS;

  if (windowExpired) {
    if (row) {
      await db
        .update(adminPasswordResetAttempts)
        .set({ count: 1, windowStart: new Date(now).toISOString() })
        .where(eq(adminPasswordResetAttempts.actorAdminId, actorAdminId));
    } else {
      await db.insert(adminPasswordResetAttempts).values({
        actorAdminId,
        count: 1,
        windowStart: new Date(now).toISOString(),
      });
    }
    return true;
  }

  if (row.count >= MAX_RESETS_PER_WINDOW) return false;

  await db
    .update(adminPasswordResetAttempts)
    .set({ count: row.count + 1 })
    .where(eq(adminPasswordResetAttempts.actorAdminId, actorAdminId));
  return true;
};
