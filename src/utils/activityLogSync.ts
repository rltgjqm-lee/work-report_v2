import type { ActivityLogItem } from "../types/form";
import { INDEXED_DB_CONFIG } from "../constants/storage";
import { createActivityLog, updateActivityLog } from "./activityLogApi";

const toPayload = (item: ActivityLogItem) => ({
  participantId: item.participantId!,
  actDate: item.date,
  startTime: item.start,
  endTime: item.end,
  content: item.content,
  place: item.place,
  hasAccident: item.accident === "유",
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

  const pending = items.filter((item) => !item.synced && item.participantId);

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
export const syncPendingActivityLogs = async (
  db: IDBDatabase | null,
): Promise<void> => {
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
