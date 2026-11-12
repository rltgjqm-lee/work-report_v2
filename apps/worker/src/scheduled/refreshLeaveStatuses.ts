import { drizzle } from "drizzle-orm/d1";

import { getKstNow } from "../lib/kst";
import { syncLeaveStatus } from "../lib/leaveStatus";
import type { Env } from "../types";

// 휴무 시작일이 된 참여자는 ON_LEAVE로, 종료일이 지난 참여자는 ACTIVE로 맞춘다 —
// 관리자가 수동으로 "복귀 처리"를 누르지 않아도 휴무 기간대로 상태가 바뀌게 하기 위함.
// 크론이 오전 9시(KST) 전엔 안 돌아서, 그 전에 출근하는 참여자는 출근 라우트가 직접 맞춘다.
export const refreshLeaveStatuses = async (env: Env["Bindings"]): Promise<void> => {
  const db = drizzle(env.DB);
  await syncLeaveStatus(db, getKstNow().date);
};
