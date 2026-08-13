import { INDEXED_DB_CONFIG } from "../../constants/storage";
import type { ActivityLogItem } from "../../types/form";

import { createActivityLog, updateActivityLog } from "../api/activityLogApi";

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

const runSyncOnce = async (db: IDBDatabase): Promise<void> => {
  const items: ActivityLogItem[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(INDEXED_DB_CONFIG.STORE_NAME, "readonly");
    const req = tx.objectStore(INDEXED_DB_CONFIG.STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  // 💡 서버가 participantId/actDate/start/end를 필수로 요구한다 — 아직 출근·퇴근을
  // 다 안 마친 진행 중인 하루치 기록은 보내봐야 매번 검증 실패만 반복되니 건너뛴다.
  // 서명 완료 시점엔 이 값들이 다 채워진 뒤에 syncNow=true로 다시 호출되니 그때 보내진다.
  const pending = items.filter(
    (item) => !item.synced && item.participantId && item.date && item.start && item.end,
  );

  for (const item of pending) {
    try {
      // 이미 서버에 등록된 적 있는 글이면(serverId 존재) 수정 API로, 처음이면 등록 API로
      const { id } = item.serverId
        ? await updateActivityLog(item.serverId, toPayload(item))
        : await createActivityLog(toPayload(item));
      await updateRecord(db, { ...item, synced: true, serverId: id });
    } catch (err) {
      console.error("활동일지 서버 동기화 실패, 다음 기회에 재시도:", err);
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
  if (!db || !navigator.onLine) return;

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
