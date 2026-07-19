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

// 재난문자 발송 이력 — 성공/실패 건수는 저장해두지 않고 조회 시 disaster_push_logs를
// 집계해서 계산한다 (발송할 때마다 카운터를 갱신하는 추가 D1 쓰기를 피하려고, 12장 결정)
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
    .leftJoin(
      disasterPushLogs,
      eq(safetyAlerts.alertId, disasterPushLogs.messageId),
    )
    .groupBy(safetyAlerts.alertId)
    .orderBy(desc(safetyAlerts.sentAt));

  return c.json(rows);
});

// 관리자가 실제 재난문자를 기다리지 않고 특정 사업단 구독자에게 테스트 푸시를 보내본다
app.post("/test", async (c) => {
  const auth = getAuth(c);
  if (!hasMinRole(auth, ROLES.ORGANIZATION_ADMIN)) {
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
