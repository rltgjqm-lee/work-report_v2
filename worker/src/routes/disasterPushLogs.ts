import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { desc, eq, sql } from "drizzle-orm";

import { safetyAlerts, disasterPushLogs } from "../db/schema";
import { hasMinRole, getAuth } from "../lib/authz";
import { ROLES, type Env } from "../types";

const app = new Hono<Env>();

// 실제로 최소 1건 이상 발송 시도된 행안부發 재난문자만 — 매칭 안 돼 아무한테도
// 안 보낸 수신 내역이나 테스트 발송(SafetyAlertsPage)은 여기 안 나온다.
app.get("/", async (c) => {
  const auth = getAuth(c);
  if (!hasMinRole(auth, ROLES.MANAGER)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const db = drizzle(c.env.DB);

  const rows = await db
    .select({
      alertId: safetyAlerts.alertId,
      message: safetyAlerts.message,
      region: safetyAlerts.region,
      alertType: safetyAlerts.alertType,
      source: safetyAlerts.source,
      sentAt: safetyAlerts.sentAt,
      targetCount: sql<number>`COUNT(${disasterPushLogs.id})`,
      successCount: sql<number>`COALESCE(SUM(CASE WHEN ${disasterPushLogs.success} = 1 THEN 1 ELSE 0 END), 0)`,
      failCount: sql<number>`COALESCE(SUM(CASE WHEN ${disasterPushLogs.success} = 0 THEN 1 ELSE 0 END), 0)`,
    })
    .from(safetyAlerts)
    .innerJoin(
      disasterPushLogs,
      eq(safetyAlerts.alertId, disasterPushLogs.messageId),
    )
    .where(eq(safetyAlerts.source, "MOIS"))
    .groupBy(safetyAlerts.alertId)
    .orderBy(desc(safetyAlerts.sentAt));

  return c.json(rows);
});

export default app;
