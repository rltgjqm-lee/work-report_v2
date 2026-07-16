import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { desc, eq, sql } from "drizzle-orm";

import { safetyAlerts, disasterPushLogs } from "../db/schema";
import { hasMinRole, getAuth } from "../lib/authz";
import type { Env } from "../types";

const app = new Hono<Env>();

// 재난문자 발송 이력 — 성공/실패 건수는 저장해두지 않고 조회 시 disaster_push_logs를
// 집계해서 계산한다 (발송할 때마다 카운터를 갱신하는 추가 D1 쓰기를 피하려고, 12장 결정)
app.get("/", async (c) => {
  const auth = getAuth(c);
  if (!hasMinRole(auth, "MANAGER")) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const db = drizzle(c.env.DB);

  const rows = await db
    .select({
      alertId: safetyAlerts.alertId,
      message: safetyAlerts.message,
      region: safetyAlerts.region,
      sentAt: safetyAlerts.sentAt,
      targetCount: sql<number>`COUNT(${disasterPushLogs.id})`,
      successCount: sql<number>`COALESCE(SUM(CASE WHEN ${disasterPushLogs.success} = 1 THEN 1 ELSE 0 END), 0)`,
      failCount: sql<number>`COALESCE(SUM(CASE WHEN ${disasterPushLogs.success} = 0 THEN 1 ELSE 0 END), 0)`,
    })
    .from(safetyAlerts)
    .leftJoin(disasterPushLogs, eq(safetyAlerts.alertId, disasterPushLogs.messageId))
    .groupBy(safetyAlerts.alertId)
    .orderBy(desc(safetyAlerts.sentAt));

  return c.json(rows);
});

export default app;
