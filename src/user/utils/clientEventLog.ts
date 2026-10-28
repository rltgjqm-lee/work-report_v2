import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";

import { getLocalToday } from "../../utils/timeFormat";

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string;
const STORAGE_KEY = "clientEventQueue";
// 폰에 쌓아두는 최대 건수 — 넘치면 오래된 것부터 버린다
const MAX_QUEUED_EVENTS = 50;

export type ClientEventKind = "CLOCK_IN" | "CLOCK_OUT" | "ACTIVITY_LOG_SYNC";

type QueuedClientEvent = {
  participantId: number;
  kind: ClientEventKind;
  workDate: string;
  occurredAt: string;
  message: string;
  httpStatus: number | null;
  online: boolean;
  connectionType: string | null;
  occurrences: number;
};

const sameEvent = (a: QueuedClientEvent, b: QueuedClientEvent) =>
  a.participantId === b.participantId &&
  a.kind === b.kind &&
  a.workDate === b.workDate &&
  a.message === b.message;

// 저장소가 막혀 있거나(사생활 보호 모드 등) 값이 깨져 있어도 앱 동작엔 영향이 없게 빈 목록으로 본다
const readQueue = (): QueuedClientEvent[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as QueuedClientEvent[]) : [];
  } catch {
    return [];
  }
};

const writeQueue = (queue: QueuedClientEvent[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.slice(-MAX_QUEUED_EVENTS)));
  } catch {
    // 저장 못 하면 이번 기록만 잃는다 — 실패 기록 때문에 본 기능이 멈추면 안 된다
  }
};

// 서버(getKstNow().iso)와 같은 형식: KST 벽시계 시각에 Z를 붙인 문자열
const nowKstIso = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString();

const readConnectionType = (): string | null => {
  const connection = (
    navigator as Navigator & { connection?: { type?: string; effectiveType?: string } }
  ).connection;
  return connection?.type ?? connection?.effectiveType ?? null;
};

/**
 * 서버에 닿지 못한 실패를 폰에 기억해 둡니다. 다음에 연결됐을 때 flushClientEvents가 보냅니다.
 * 같은 날·같은 종류·같은 사유는 한 건으로 묶고 횟수만 늘려서, 재시도할 때마다 쌓이지 않게 합니다.
 *
 * 서버가 이미 기록하는 실패(출퇴근 요청이 서버에 닿아 거부된 경우)는 남기지 않습니다.
 */
export const recordClientEvent = ({
  participantId,
  kind,
  message,
  httpStatus = null,
  workDate = getLocalToday(),
}: {
  participantId: number;
  kind: ClientEventKind;
  message: string;
  httpStatus?: number | null;
  // 업무일지 실패는 그 일지의 날짜로 남긴다(지난 날짜 일지를 오늘 다시 보내다 실패할 수 있다)
  workDate?: string;
}) => {
  const event: QueuedClientEvent = {
    participantId,
    kind,
    workDate,
    occurredAt: nowKstIso(),
    message,
    httpStatus,
    online: navigator.onLine,
    connectionType: readConnectionType(),
    occurrences: 1,
  };

  const queue = readQueue();
  const existing = queue.find((queued) => sameEvent(queued, event));
  if (existing) {
    existing.occurrences += 1;
    existing.occurredAt = event.occurredAt;
    existing.online = event.online;
    existing.connectionType = event.connectionType;
    existing.httpStatus = event.httpStatus;
  } else {
    queue.push(event);
  }
  writeQueue(queue);
};

// 출근 요청에도 같이 실어 보낸다(attendanceApi) — 위치 보고가 끊기는 사람이 어떤 앱 버전인지 보려고
export const readAppInfo = async () => {
  const platform = Capacitor.getPlatform();
  if (!Capacitor.isNativePlatform()) {
    return { platform, appVersion: null, bundleVersion: null };
  }
  const [appInfo, bundle] = await Promise.all([
    App.getInfo().catch(() => null),
    CapacitorUpdater.current().catch(() => null),
  ]);
  return {
    platform,
    appVersion: appInfo?.version ?? null,
    bundleVersion: bundle?.bundle.version ?? null,
  };
};

let isFlushing = false;

/**
 * 폰에 쌓인 실패 기록을 서버로 보냅니다. 보낼 게 없으면 아무 요청도 하지 않습니다 —
 * 평소(실패 없음)에는 추가 호출이 0건입니다. 보내지 못하면 그대로 두고 다음 기회에 다시 보냅니다.
 */
export const flushClientEvents = async (participantId: number): Promise<void> => {
  if (isFlushing || !navigator.onLine) return;
  const toSend = readQueue().filter((event) => event.participantId === participantId);
  if (toSend.length === 0) return;

  isFlushing = true;
  try {
    const appInfo = await readAppInfo();
    const response = await fetch(`${BASE_URL}/public/client-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantId,
        ...appInfo,
        events: toSend.map((event) => ({
          kind: event.kind,
          workDate: event.workDate,
          occurredAt: event.occurredAt,
          message: event.message,
          httpStatus: event.httpStatus,
          online: event.online,
          connectionType: event.connectionType,
          occurrences: event.occurrences,
        })),
      }),
    });
    if (!response.ok) return;

    // 보내는 사이 새로 쌓였거나 횟수가 늘어난 기록은 남긴다 — 보낸 것과 똑같은 것만 지운다
    writeQueue(
      readQueue().filter(
        (queued) =>
          !toSend.some(
            (sent) =>
              sameEvent(sent, queued) &&
              sent.occurrences === queued.occurrences &&
              sent.occurredAt === queued.occurredAt,
          ),
      ),
    );
  } catch {
    // 네트워크 실패 — 다음 기회에 다시 보낸다
  } finally {
    isFlushing = false;
  }
};
