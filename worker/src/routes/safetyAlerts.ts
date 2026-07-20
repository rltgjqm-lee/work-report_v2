import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { desc, eq, sql } from "drizzle-orm";

import {
  safetyAlerts,
  disasterPushLogs,
  programs,
  pushSubscriptions,
} from "../db/schema";
import { hasMinRole, canAccessProgram, getAuth } from "../lib/authz";
import { sendWebPush } from "../lib/webPush";
import { ROLES, type Env } from "../types";

const app = new Hono<Env>();

// 행안부 원본 수신 내역 전체(매칭 안 돼 아무한테도 안 보낸 것 포함) + 테스트 발송 내역.
// 실제 발송된 것만 보고 싶으면 /api/disaster-push-logs를 쓴다 — 이 엔드포인트는
// 진단/테스트 목적이라 SUPER_ADMIN만 조회 가능.
app.get("/", async (c) => {
  const auth = getAuth(c);
  if (!hasMinRole(auth, ROLES.SUPER_ADMIN)) {
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
    .leftJoin(
      disasterPushLogs,
      eq(safetyAlerts.alertId, disasterPushLogs.messageId),
    )
    .groupBy(safetyAlerts.alertId)
    .orderBy(desc(safetyAlerts.sentAt));

  return c.json(rows);
});

// 관리자가 실제 재난문자를 기다리지 않고 특정 사업단 구독자에게 테스트 푸시를 보내본다
// (SafetyAlertsPage와 함께 SUPER_ADMIN 전용 진단 도구)
app.post("/test", async (c) => {
  const auth = getAuth(c);
  if (!hasMinRole(auth, ROLES.SUPER_ADMIN)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const db = drizzle(c.env.DB);
  const body = await c.req.json<{ message?: string; programId?: number }>();
  if (!body.message || !body.programId) {
    return c.json({ error: "message, programId are required" }, 400);
  }

  const programRows = await db
    .select()
    .from(programs)
    .where(eq(programs.id, body.programId));
  const program = programRows[0];
  if (!program) return c.json({ error: "Not found" }, 404);
  if (!canAccessProgram(auth, program)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.programId, body.programId));

  const alertId = crypto.randomUUID();
  const sentAt = new Date().toISOString();

  await db.insert(safetyAlerts).values({
    alertId,
    message: body.message,
    region: null,
    alertType: "TEST",
    source: "MANUAL",
    sentAt,
  });

  let successCount = 0;
  for (const subscription of subscriptions) {
    const result = await sendWebPush(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      { title: "🚨 안전문자 테스트", body: body.message },
      { privateJWK: c.env.VAPID_PRIVATE_KEY, subject: c.env.VAPID_SUBJECT },
    );

    await db.insert(disasterPushLogs).values({
      programId: body.programId,
      messageId: alertId,
      endpoint: subscription.endpoint,
      success: result.ok,
    });

    if (result.ok) {
      successCount++;
    } else if (result.expired) {
      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
    }
  }

  return c.json({
    ok: true,
    alertId,
    targetCount: subscriptions.length,
    successCount,
  });
});

export default app;
