import { drizzle } from "drizzle-orm/d1";
import { and, eq, isNull, lt, or } from "drizzle-orm";

import {
  attendanceLogs,
  participantEscapeMeta,
  pushSubscriptions,
} from "../db/schema";
import { sendWebPush } from "../lib/webPush";
import { getKstNow } from "../lib/kst";
import type { Env } from "../types";

// 이 시간 이상 위치 신호가 없으면 통신 끊김으로 본다
const SIGNAL_LOSS_MINUTES = 15;

// 출근 중인데 위치 신호가 끊긴 참여자에게 알림을 보낸다. 이미 알림을 보낸 상태(signalLossAlertedAt)면
// 반복 발송하지 않고, 새 위치가 들어오면(/public/location) 그 표시가 풀려서 다시 알릴 수 있게 된다.
export const checkSignalLoss = async (env: Env["Bindings"]): Promise<void> => {
  const db = drizzle(env.DB);
  const { date, iso } = getKstNow();
  const staleBefore = new Date(
    Date.parse(iso) - SIGNAL_LOSS_MINUTES * 60 * 1000,
  ).toISOString();

  const rows = await db
    .select({
      participantId: attendanceLogs.participantId,
      lastLocationAt: participantEscapeMeta.lastLocationAt,
      signalLossAlertedAt: participantEscapeMeta.signalLossAlertedAt,
    })
    .from(attendanceLogs)
    .leftJoin(
      participantEscapeMeta,
      eq(attendanceLogs.participantId, participantEscapeMeta.participantId),
    )
    .where(
      and(
        eq(attendanceLogs.workDate, date),
        isNull(attendanceLogs.clockOut),
        isNull(participantEscapeMeta.signalLossAlertedAt),
        or(
          isNull(participantEscapeMeta.lastLocationAt),
          lt(participantEscapeMeta.lastLocationAt, staleBefore),
        ),
      ),
    );

  for (const row of rows) {
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.participantId, row.participantId));

    for (const subscription of subscriptions) {
      const result = await sendWebPush(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        {
          title: "⚠️ 통신 끊김",
          body: `${SIGNAL_LOSS_MINUTES}분 이상 위치 신호가 수신되지 않았습니다.`,
        },
        { privateJWK: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT },
      );
      if (!result.ok && result.expired) {
        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
      }
    }

    await db
      .insert(participantEscapeMeta)
      .values({ participantId: row.participantId, signalLossAlertedAt: iso })
      .onConflictDoUpdate({
        target: participantEscapeMeta.participantId,
        set: { signalLossAlertedAt: iso },
      });
  }
};
