import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { adminPasswordResetRequests } from "../db/schema";

// 비로그인 상태의 "비밀번호 찾기" 요청 — 이메일당 1시간에 3건까지만 허용해서
// 같은 계정으로 재설정 메일을 무한정 발송(스팸/메일함 폭탄)하는 남용을 막는다.
const MAX_REQUESTS_PER_WINDOW = 3;
const WINDOW_MS = 60 * 60 * 1000;

type DB = ReturnType<typeof drizzle>;

export const tryConsumePasswordResetRequestBudget = async (
  db: DB,
  email: string,
): Promise<boolean> => {
  const rows = await db
    .select()
    .from(adminPasswordResetRequests)
    .where(eq(adminPasswordResetRequests.email, email));
  const row = rows[0];
  const now = Date.now();

  const windowExpired = !row || now - new Date(row.windowStart).getTime() > WINDOW_MS;

  if (windowExpired) {
    if (row) {
      await db
        .update(adminPasswordResetRequests)
        .set({ count: 1, windowStart: new Date(now).toISOString() })
        .where(eq(adminPasswordResetRequests.email, email));
    } else {
      await db.insert(adminPasswordResetRequests).values({
        email,
        count: 1,
        windowStart: new Date(now).toISOString(),
      });
    }
    return true;
  }

  if (row.count >= MAX_REQUESTS_PER_WINDOW) return false;

  await db
    .update(adminPasswordResetRequests)
    .set({ count: row.count + 1 })
    .where(eq(adminPasswordResetRequests.email, email));
  return true;
};
