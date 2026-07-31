import { drizzle } from "drizzle-orm/d1";
import { and, eq, lt } from "drizzle-orm";

import { participants } from "../db/schema";
import { getKstNow } from "../lib/kst";
import type { Env } from "../types";

// 휴무 종료일(leaveEnd)이 지났는데도 ON_LEAVE로 남아있는 참여자를 ACTIVE로 되돌린다.
// 관리자가 수동으로 "복귀 처리"를 누르지 않아도 다음날부터 정상 출근할 수 있게 하기 위함.
export const returnFromLeave = async (env: Env["Bindings"]): Promise<void> => {
  const db = drizzle(env.DB);
  const { date } = getKstNow();

  await db
    .update(participants)
    .set({ status: "ACTIVE", leaveStart: null, leaveEnd: null })
    .where(and(eq(participants.status, "ON_LEAVE"), lt(participants.leaveEnd, date)));
};
