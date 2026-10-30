import { INDEXED_DB_CONFIG } from "../../constants/storage";
import type { ActivityLogItem } from "../../types/form";
import { getLocalToday } from "../../utils/timeFormat";

import { ActivityLogApiError, createActivityLog, updateActivityLog } from "../api/activityLogApi";
import { recordClientEvent } from "./clientEventLog";

const toPayload = (item: ActivityLogItem) => ({
  participantId: item.participantId!,
  actDate: item.date,
  startTime: item.start,
  endTime: item.end,
  content: item.content,
  place: item.place,
  hasAccident: item.accident === "유",
  accidentChecked: item.accidentChecked ?? false,
  accidentDetail: item.accidentDetail,
  accidentAction: item.accidentAction,
  userSignature: item.uSign,
  demandSignature: item.dSign,
});

const updateRecord = (db: IDBDatabase, item: ActivityLogItem) =>
  new Promise<void>((resolve, reject) => {
    const tx = db.transaction(INDEXED_DB_CONFIG.STORE_NAME, "readwrite");
    const req = tx.objectStore(INDEXED_DB_CONFIG.STORE_NAME).put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

// 💡 서버가 participantId/actDate/start/end와 참여자 서명을 필수로 요구한다 — 아직 출근·퇴근이나
// 서명을 다 안 마친 하루치 기록은 보내봐야 매번 "서명 필요"로 거부만 반복되니(앱을 열 때마다
// 재전송돼 수백 번씩 쌓였다) 건너뛴다. 서명 완료 시점에 syncNow=true로 다시 호출되니 그때 보내진다.
const readPendingItems = async (db: IDBDatabase): Promise<ActivityLogItem[]> => {
  const items: ActivityLogItem[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(INDEXED_DB_CONFIG.STORE_NAME, "readonly");
    const req = tx.objectStore(INDEXED_DB_CONFIG.STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  return items.filter(
    (item) =>
      !item.synced && item.participantId && item.date && item.start && item.end && item.uSign,
  );
};

const runSyncOnce = async (db: IDBDatabase): Promise<void> => {
  const pending = await readPendingItems(db);

  for (const item of pending) {
    try {
      // 이미 서버에 등록된 적 있는 글이면(serverId 존재) 수정 API로, 처음이면 등록 API로
      const { id } = item.serverId
        ? await updateActivityLog(item.serverId, toPayload(item))
        : await createActivityLog(toPayload(item));
      await updateRecord(db, { ...item, synced: true, serverId: id });
    } catch (error) {
      console.error("활동일지 서버 동기화 실패, 다음 기회에 재시도:", error);
      // 폰에만 남은 일지(서명 포함)는 서버가 알 길이 없어서, 실패 사실을 남겨 다음 연결 때 보낸다
      recordClientEvent({
        participantId: item.participantId!,
        kind: "ACTIVITY_LOG_SYNC",
        workDate: item.date,
        message: error instanceof Error ? error.message : "업무일지 전송 실패",
        httpStatus: error instanceof ActivityLogApiError ? error.status : null,
      });
    }
  }
};

// 마운트 직후(React StrictMode의 이펙트 이중 실행 포함)와 online 이벤트가 겹쳐 들어와도
// 같은 미동기화 레코드를 동시에 두 번 POST하지 않도록 직렬화한다.
let isSyncing = false;
let rerunRequested = false;

/**
 * IndexedDB에 쌓인, 아직 서버에 반영 안 된(synced !== true) 활동일지를 온라인일 때 순서대로
 * 서버로 재전송한다. participantId가 없는 레코드(본인확인 이전 구버전 데이터)는 건너뛴다.
 * 네트워크 실패 시 그 레코드는 그대로 두고 다음 호출 때 다시 시도한다.
 */
export const syncPendingActivityLogs = async (db: IDBDatabase | null): Promise<void> => {
  if (!db) return;
  if (!navigator.onLine) {
    // 서명은 했는데 인터넷이 없어 폰에만 남은 경우 — 나중에 "서명했다는데 안 들어왔다"는
    // 문의가 오면 이 기록으로 확인한다. 연결되면 아래 동기화와 실패 기록 전송이 이어진다.
    const pending = await readPendingItems(db).catch(() => []);
    pending.forEach((item) =>
      recordClientEvent({
        participantId: item.participantId!,
        kind: "ACTIVITY_LOG_SYNC",
        workDate: item.date,
        message: "인터넷 연결이 없어 폰에 전송 대기 중",
      }),
    );
    return;
  }

  if (isSyncing) {
    rerunRequested = true;
    return;
  }

  isSyncing = true;
  try {
    await runSyncOnce(db);
  } finally {
    isSyncing = false;
    if (rerunRequested) {
      rerunRequested = false;
      await syncPendingActivityLogs(db);
    }
  }
};

// 폰에 일지를 남겨두는 기간 — 지난 일지는 서버에서 다시 받아올 수 있어(GET /activity-logs) 오래
// 들고 있을 필요가 없다. 서명 이미지가 일지마다 들어 있어 지우지 않으면 계속 쌓인다.
const LOCAL_LOG_RETENTION_DAYS = 30;

/**
 * 오래된 활동일지를 폰(IndexedDB)에서 지운다. 서버에 전송된 것, 또는 서명이 없어 앞으로도 보낼 수
 * 없는 것만 지운다 — 서명까지 했는데 아직 전송 못 한 일지는 폰에만 있는 원본이라 날짜가 지나도
 * 남겨둔다(다음 연결 때 재전송된다).
 */
export const pruneOldActivityLogs = async (db: IDBDatabase): Promise<void> => {
  const cutoff = new Date(`${getLocalToday()}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - LOCAL_LOG_RETENTION_DAYS);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  await new Promise<void>((resolve) => {
    const tx = db.transaction(INDEXED_DB_CONFIG.STORE_NAME, "readwrite");
    const store = tx.objectStore(INDEXED_DB_CONFIG.STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const items: ActivityLogItem[] = request.result || [];
      items
        .filter(
          (item) =>
            item.id !== undefined &&
            item.date &&
            item.date < cutoffDate &&
            (item.synced || !item.uSign),
        )
        .forEach((item) => store.delete(item.id!));
    };
    tx.oncomplete = () => resolve();
    // 정리 실패는 다음에 앱을 열 때 다시 시도하면 된다 — 화면 동작에는 영향이 없다
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
};

/**
 * 동기화를 시도한 뒤에도 여전히 synced:false로 남아있는 지난 날짜(오늘 이전) 기록을 찾는다.
 * 업무일지/안전일지/서명 중 하나라도 빠져 있으면 서버가 거부해 계속 synced:false로 남으므로,
 * 이 함수가 무언가를 찾았다는 것 자체가 "그날 완료를 못 했다"는 뜻이다.
 */
export const findIncompleteActivityLogDate = (
  db: IDBDatabase,
  participantId: number,
  today: string,
): Promise<string | null> =>
  new Promise((resolve) => {
    const tx = db.transaction(INDEXED_DB_CONFIG.STORE_NAME, "readonly");
    const req = tx.objectStore(INDEXED_DB_CONFIG.STORE_NAME).getAll();
    req.onsuccess = () => {
      const items: ActivityLogItem[] = req.result || [];
      const incomplete = items.find(
        (item) => item.participantId === participantId && item.date < today && !item.synced,
      );
      resolve(incomplete?.date ?? null);
    };
    req.onerror = () => resolve(null);
  });
