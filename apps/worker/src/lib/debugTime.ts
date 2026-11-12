import type { Context } from "hono";

import { ROLES, type Env } from "../types";
import { tryGetAdmin } from "./authz";

// 로컬 개발(wrangler dev, http://localhost:8787)에서는 자유롭게, 배포된 서버에서는
// 통합관리자(SUPER_ADMIN)로 로그인한 세션에서만 출퇴근 테스트용 날짜·시간
// override("YYYY-MM-DD"/"HH:MM")를 허용한다. 그 외에는 무시하고 실제 KST 날짜·시각을 쓴다.
export const readDebugOverride = async (
  c: Context<Env>,
  body: { debugDate?: string; debugTime?: string },
): Promise<{ date?: string; time?: string }> => {
  if (!body.debugDate && !body.debugTime) return {};

  const hostname = new URL(c.req.url).hostname;
  const isLocalDev = hostname === "localhost" || hostname === "127.0.0.1";

  if (!isLocalDev) {
    const admin = await tryGetAdmin(c);
    if (admin?.role !== ROLES.SUPER_ADMIN) return {};
  }

  return { date: body.debugDate, time: body.debugTime };
};
