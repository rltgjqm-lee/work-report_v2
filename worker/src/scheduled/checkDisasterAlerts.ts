import { drizzle } from "drizzle-orm/d1";
import { eq, inArray } from "drizzle-orm";

import {
  programs,
  organizations,
  pushSubscriptions,
  safetyAlerts,
  disasterPushLogs,
  disasterApiCallLog,
  pendingPushes,
} from "../db/schema";
import {
  fetchDisasterMessagesPage,
  type DisasterMessage,
} from "../lib/disasterMsgApi";
import { sendWebPush } from "../lib/webPush";
import { getKstNow } from "../lib/kst";
import { isWeekendOrHoliday } from "../lib/koreanHolidays";
import type { Env } from "../types";

// Workers 무료 플랜은 실행(invocation) 1번당 외부 fetch(subrequest)가 50개로 제한된다.
// 재난문자 API 조회에 1개를 쓰므로, 실제 푸시 발송은 실행당 이 개수만큼만 처리하고
// 나머지는 pending_pushes에 남겨뒀다가 다음 실행(1분 뒤)에 이어서 보낸다.
const MAX_PUSHES_PER_RUN = 40;

// 행안부 API는 하루 1000회 호출 한도. 이 한도에 도달하면 그날 남은 폴링은 API를
// 호출하지 않고 건너뛴다 — 한도를 넘겨서 그날 이후 재난문자를 아예 못 받는 사고를 막기 위함.
const DAILY_CALL_CAP = 1000;
// 한 페이지가 최대 1000건이라 하루치가 이 페이지 수를 넘는 건 사실상 대규모 재난 상황뿐 —
// 그래도 무한 루프 방지용 안전장치로 상한을 둔다.
const MAX_PAGES_PER_RUN = 5;

type DB = ReturnType<typeof drizzle>;

// RCPTN_RGN_NM은 콤마로 여러 지역을 나열하는데("경기도 안성시 ,경기도 오산시 "),
// 시/도 전역 알림은 시/군/구 없이 시/도만 온다("경기도  "). 이 구간이 시/도 이름
// 그 자체(뒤에 시/군/구 없이 공백만)인지 확인해서 전역 알림 여부를 판단한다.
const isSidoOnlySegment = (segment: string, sido: string): boolean => {
  const trimmed = segment.trim();
  if (!trimmed.startsWith(sido)) return false;
  return trimmed.slice(sido.length).trim() === "";
};

// 시/군/구가 명시된 알림은 그 시/군/구 이름이 그대로 포함돼 있어야 매칭되고,
// 시/도 전역 알림(시/군/구 없이 시/도만 옴)은 시/군/구와 무관하게 그 시/도 소속
// 사업단 전부에 매칭된다.
const matchesOrgRegion = (
  regionText: string,
  sido: string,
  sigungu: string,
): boolean => {
  if (!regionText.includes(sido)) return false;
  if (regionText.includes(sigungu)) return true;
  return regionText
    .split(",")
    .some((segment) => isSidoOnlySegment(segment, sido));
};

// 오늘 날짜(KST)의 호출 카운트를 확인하고, 한도 안이면 카운트를 올리고 true를 반환한다.
// 한도에 도달했으면 카운트를 올리지 않고 false를 반환 — 호출하는 쪽은 이때 API를 호출하면 안 된다.
const tryConsumeApiCallBudget = async (
  db: DB,
  date: string,
): Promise<boolean> => {
  const rows = await db
    .select()
    .from(disasterApiCallLog)
    .where(eq(disasterApiCallLog.date, date));
  const current = rows[0]?.callCount ?? 0;
  if (current >= DAILY_CALL_CAP) return false;

  if (rows[0]) {
    await db
      .update(disasterApiCallLog)
      .set({ callCount: current + 1 })
      .where(eq(disasterApiCallLog.date, date));
  } else {
    await db.insert(disasterApiCallLog).values({ date, callCount: 1 });
  }
  return true;
};

// crtDt=오늘(KST)로 페이지를 이어가며 그날치 재난문자를 전부 모은다.
// 호출마다 일일 예산을 확인하고, 예산이 소진되면 그 자리에서 멈춘다(이미 모은 것까지는 처리).
const fetchTodaysMessagesWithBudget = async (
  db: DB,
  env: Env["Bindings"],
  date: string,
): Promise<DisasterMessage[]> => {
  const crtDt = date.replaceAll("-", "");
  const collected: DisasterMessage[] = [];

  for (let pageNo = 1; pageNo <= MAX_PAGES_PER_RUN; pageNo++) {
    const allowed = await tryConsumeApiCallBudget(db, date);
    if (!allowed) {
      console.error(
        `재난문자 API 일일 호출 한도(${DAILY_CALL_CAP}회) 도달 — 이후 폴링을 건너뜁니다.`,
      );
      break;
    }

    const { messages, totalCount } = await fetchDisasterMessagesPage(
      env.DISASTER_API_KEY,
      crtDt,
      pageNo,
    );
    collected.push(...messages);

    if (collected.length >= totalCount || messages.length === 0) break;
  }

  return collected;
};

// 1단계: 새 재난문자를 조회해서 지역/근무시간에 매칭되는 구독을 대기열에 적재만 한다
const enqueueNewMatches = async (
  db: DB,
  env: Env["Bindings"],
): Promise<void> => {
  const { date } = getKstNow();
  const messages = await fetchTodaysMessagesWithBudget(db, env, date);
  if (messages.length === 0) return;

  const processedRows = await db
    .select({ alertId: safetyAlerts.alertId })
    .from(safetyAlerts);
  const processedIds = new Set(processedRows.map((r) => r.alertId));
  const newMessages = messages.filter((m) => !processedIds.has(m.id));
  if (newMessages.length === 0) return;

  const { time } = getKstNow();

  // 지역은 4장 결정에 따라 organizations(기관)에 있음 — 사업단은 소속 기관의 지역을 그대로 상속
  const programsWithOrg = await db
    .select({ program: programs, org: organizations })
    .from(programs)
    .innerJoin(organizations, eq(programs.organizationId, organizations.id));

  for (const message of newMessages) {
    const matchingPrograms = programsWithOrg.filter(({ program, org }) => {
      if (!org.regionSido || !org.regionSigungu) return false;
      if (
        !matchesOrgRegion(message.region, org.regionSido, org.regionSigungu)
      ) {
        return false;
      }
      if (date < program.startDate || date > program.endDate) return false;
      if (time < program.startTime || time > program.endTime) return false;
      return true;
    });

    if (matchingPrograms.length > 0) {
      const programIds = matchingPrograms.map(({ program }) => program.id);
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
      .insert(safetyAlerts)
      .values({
        alertId: message.id,
        message: message.message,
        region: message.region,
        alertType: message.alertType,
        source: "MOIS",
        sentAt: message.sentAt,
      })
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
  // 주말/공휴일엔 아무도 근무하지 않으니 재난문자를 조회할 이유가 없다 —
  // 조회 자체를 건너뛰어 일일 호출 예산도 아낀다.
  const { date } = getKstNow();
  if (isWeekendOrHoliday(date)) return;

  const db = drizzle(env.DB);

  await enqueueNewMatches(db, env);
  await drainPushQueue(db, env);
};
