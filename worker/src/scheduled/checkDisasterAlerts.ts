import { drizzle } from "drizzle-orm/d1";
import { eq, inArray } from "drizzle-orm";

import {
  programs,
  pushSubscriptions,
  processedDisasterMessages,
  disasterPushLogs,
  pendingPushes,
} from "../db/schema";
import { fetchRecentDisasterMessages } from "../lib/disasterMsgApi";
import { sendWebPush } from "../lib/webPush";
import type { Env } from "../types";

// Workers 무료 플랜은 실행(invocation) 1번당 외부 fetch(subrequest)가 50개로 제한된다.
// 재난문자 API 조회에 1개를 쓰므로, 실제 푸시 발송은 실행당 이 개수만큼만 처리하고
// 나머지는 pending_pushes에 남겨뒀다가 다음 실행(1분 뒤)에 이어서 보낸다.
const MAX_PUSHES_PER_RUN = 40;

const getKstNow = () => {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const iso = kst.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
};

type DB = ReturnType<typeof drizzle>;

// 1단계: 새 재난문자를 조회해서 지역/근무시간에 매칭되는 구독을 대기열에 적재만 한다 (외부 fetch 없음)
const enqueueNewMatches = async (
  db: DB,
  env: Env["Bindings"],
): Promise<void> => {
  const messages = await fetchRecentDisasterMessages(env.DISASTER_API_KEY);
  if (messages.length === 0) return;

  const processedRows = await db
    .select({ id: processedDisasterMessages.id })
    .from(processedDisasterMessages);
  const processedIds = new Set(processedRows.map((r) => r.id));
  const newMessages = messages.filter((m) => !processedIds.has(m.id));
  if (newMessages.length === 0) return;

  const { date, time } = getKstNow();
  const allPrograms = await db.select().from(programs);

  for (const message of newMessages) {
    const matchingPrograms = allPrograms.filter((p) => {
      if (!p.regionSido || !p.regionSigungu) return false;
      if (
        !message.region.includes(p.regionSido) ||
        !message.region.includes(p.regionSigungu)
      ) {
        return false;
      }
      if (date < p.startDate || date > p.endDate) return false;
      if (time < p.startTime || time > p.endTime) return false;
      return true;
    });

    if (matchingPrograms.length > 0) {
      const programIds = matchingPrograms.map((p) => p.id);
      const subscriptions = await db
        .select()
        .from(pushSubscriptions)
        .where(inArray(pushSubscriptions.programId, programIds));

      if (subscriptions.length > 0) {
        await db.insert(pendingPushes).values(
          subscriptions.map((sub) => ({
            programId: sub.programId,
            messageId: message.id,
            endpoint: sub.endpoint,
            p256dh: sub.p256dh,
            auth: sub.auth,
            body: message.message,
          })),
        );
      }
    }

    await db
      .insert(processedDisasterMessages)
      .values({ id: message.id })
      .onConflictDoNothing();
  }
};

// 2단계: 대기열에서 실행당 정해진 개수만큼만 꺼내 실제로 발송한다
const drainPushQueue = async (db: DB, env: Env["Bindings"]): Promise<void> => {
  const queued = await db
    .select()
    .from(pendingPushes)
    .orderBy(pendingPushes.id)
    .limit(MAX_PUSHES_PER_RUN);

  for (const item of queued) {
    try {
      const result = await sendWebPush(
        {
          endpoint: item.endpoint,
          keys: { p256dh: item.p256dh, auth: item.auth },
        },
        { title: "🚨 재난문자", body: item.body },
        { privateJWK: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT },
      );

      await db.insert(disasterPushLogs).values({
        programId: item.programId,
        messageId: item.messageId,
        endpoint: item.endpoint,
        success: result.ok,
      });

      if (!result.ok && result.expired) {
        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.endpoint, item.endpoint));
      }
    } catch (err) {
      console.error("푸시 발송 중 오류:", err);
      await db.insert(disasterPushLogs).values({
        programId: item.programId,
        messageId: item.messageId,
        endpoint: item.endpoint,
        success: false,
      });
    } finally {
      // 성공/실패/예외 여부와 상관없이 큐에서 제거 — 안 그러면 이 항목이 계속
      // 다음 실행에서도 맨 앞에 걸려서 뒤에 있는 다른 발송 건들을 막아버림
      await db.delete(pendingPushes).where(eq(pendingPushes.id, item.id));
    }
  }
};

export const checkDisasterAlerts = async (
  env: Env["Bindings"],
): Promise<void> => {
  const db = drizzle(env.DB);

  await enqueueNewMatches(db, env);
  await drainPushQueue(db, env);
};
