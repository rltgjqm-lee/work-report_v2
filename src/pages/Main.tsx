import { useState, useEffect, useRef } from "react";

import ConfirmModal from "../components/molecule/ConfirmModal";

import AffiliationInputPage from "./main_pages/AffiliationInputPage";
import RegistrationConfirmPage from "./main_pages/RegistrationConfirmPage";
import HomePage from "./main_pages/HomePage";
import AttendanceModulePage from "./main_pages/AttendanceModulePage";
import ActivityReportPage from "./main_pages/ActivityReportPage";
import AccidentCheckPage from "./main_pages/AccidentCheckPage";
import ActivitySummaryPage from "./main_pages/ActivitySummaryPage";
import SignaturePage from "./main_pages/SignaturePage";

import type { ActivityLogFormData, ActivityLogItem } from "../types/form";

import { INDEXED_DB_CONFIG, LOCAL_STORAGE_KEYS } from "../constants/storage";
import { syncPendingActivityLogs } from "../utils/activityLogSync";
import { formatTimeField, hhmmToTimeParts } from "../utils/timeFormat";

const VIEW_TYPE = {
  AFFILIATION: "affiliation",
  REGISTRATION_CONFIRM: "registrationConfirm",
  HOME: "home",
  ATTENDANCE_OUT: "attendanceOut",
  REPORT: "report",
  ACCIDENT: "accident",
  SUMMARY: "summary",
  SIGNATURE: "signature",
} as const;

export type View = (typeof VIEW_TYPE)[keyof typeof VIEW_TYPE];

// 💡 폼 데이터를 IndexedDB의 ActivityLogItem 한 건으로 변환.
// preserve로 기존 레코드의 serverId만 이어받는다(있으면 다음 동기화 때 수정 API를 씀).
// synced는 매번 저장할 때마다 false로 찍어서 — 한 번 동기화된 뒤 다음 단계에서 내용이
// 더 채워져도 다시 서버에 반영되도록 한다.
const buildLogItemFromFormData = (
  formData: ActivityLogFormData,
  preserve?: Pick<ActivityLogItem, "serverId">,
): ActivityLogItem => ({
  ...(formData.id !== undefined && { id: formData.id }),
  participantId: formData.participantId,
  synced: false,
  serverId: preserve?.serverId,
  date: formData.actDate,
  start: formatTimeField(formData.startTime),
  end: formatTimeField(formData.endTime),
  totalTime: formData.actTotalTime,
  content: formData.actContent,
  place: formData.actPlace,
  accident: formData.hasAccident ? "유" : "무",
  accidentChecked: formData.accidentChecked,
  accidentDetail: formData.accidentDetail,
  accidentAction: formData.accidentAction,
  uSign: formData.userSignature || "",
  dSign: formData.demandSignature || "",
  timestamp: Date.now(),
});

const initialFormData: ActivityLogFormData = {
  id: undefined, // 💡 고유 키값 추적을 위해 id 필드를 추가합니다 (처음엔 없음)
  orgName: "",
  programName: "",
  demandName: "",
  gender: "",
  userName: "",
  phoneLast4: "",
  programType: "",
  actDate: "",
  // 💡 출근/퇴근 버튼을 눌러야 채워짐 — hour가 비어있으면 "아직 출근 전"으로 판단한다.
  startTime: { ampm: "AM", hour: "", minute: "" },
  endTime: { ampm: "PM", hour: "", minute: "" },
  actTotalTime: "- 시간",
  actContent: "",
  actPlace: "",
  hasAccident: false,
  accidentChecked: false,
  accidentDetail: "",
  accidentAction: "업무수행",
  userSignature: "", // ⚠️ 주의: 아래 저장 로직과 서명 필드명을 일치시켜야 합니다.
  demandSignature: "",
};

// 💡 새로고침해도 등록 상태(참여자 식별, 오늘 진행 상황)가 유지되도록 formData
// 변경마다 저장해두는 draft를 읽어온다. 서명은 크기가 커서 별도 키로 관리되니 여기엔 안 담는다.
const loadFormDraft = (): Partial<ActivityLogFormData> => {
  try {
    const draftRaw = localStorage.getItem(LOCAL_STORAGE_KEYS.FORM_DRAFT);
    return draftRaw ? JSON.parse(draftRaw) : {};
  } catch {
    return {};
  }
};

const Main = () => {
  const [db, setDb] = useState<IDBDatabase | null>(null);
  // 💡 draft에 participantId가 남아있으면(이미 등록을 마쳤던 상태) 새로고침해도
  // 기본정보 페이지부터 다시 밟지 않도록 곧장 홈으로 복귀시킨다.
  const [view, setView] = useState<View>(() =>
    loadFormDraft().participantId ? VIEW_TYPE.HOME : VIEW_TYPE.AFFILIATION,
  );

  // 모달 상태
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessages, setModalMessages] = useState<string[]>([]);

  const [formData, setFormData] = useState<ActivityLogFormData>(() => ({
    ...initialFormData,
    ...loadFormDraft(),
    // 💡 서명은 별도 키로 관리되므로 초안보다 우선한다
    userSignature: localStorage.getItem(LOCAL_STORAGE_KEYS.USER_SIGN) || "",
    demandSignature: localStorage.getItem(LOCAL_STORAGE_KEYS.DEMAND_SIGN) || "",
  }));

  // functions
  // 💡 "확인" 누를 때까지 기다렸다가 다음 동작(예: 저장 후 홈 이동)을 이어가야 하는
  // 곳(handleStepDataSave)이 있어서, 모달을 네이티브 alert()처럼 await 가능하게
  // Promise로 감싼다. resolve는 모달을 닫을 때(handleAlertModalClose) 호출한다.
  const modalResolveRef = useRef<(() => void) | null>(null);

  const handleAlertModalOpen = (messages: string[]): Promise<void> => {
    setModalMessages(messages);
    setModalOpen(true);
    return new Promise((resolve) => {
      modalResolveRef.current = resolve;
    });
  };

  const handleAlertModalClose = () => {
    setModalOpen(false);
    modalResolveRef.current?.();
    modalResolveRef.current = null;
  };

  const handleInputChange = <T extends keyof ActivityLogFormData>(
    field: T,
    value: ActivityLogFormData[T],
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: typeof value === "string" ? value : value,
    }));
  };

  const handleStepDataSave = async () => {
    if (!db) {
      await handleAlertModalOpen(["데이터베이스가 연결되지 않았습니다."]);
      return;
    }

    // 💡 이미 저장된 적 있는 글이면(id 존재) 그 레코드의 동기화 상태(synced/serverId)를
    // 읽어와 보존한다 — 안 그러면 저장할 때마다 서버에 중복으로 다시 등록되어 버린다.
    const existing =
      formData.id !== undefined
        ? await new Promise<ActivityLogItem | undefined>((resolve) => {
            const req = db
              .transaction(INDEXED_DB_CONFIG.STORE_NAME, "readonly")
              .objectStore(INDEXED_DB_CONFIG.STORE_NAME)
              .get(formData.id!);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(undefined);
          })
        : undefined;

    // 💡 데이터 포맷 조립 (IndexedDB의 ActivityLogItem 스키마와 동기화)
    const logItem = buildLogItemFromFormData(formData, existing);

    // 💡 서명 재사용을 위해 localStorage에도 보관
    if (formData.userSignature) {
      localStorage.setItem(
        LOCAL_STORAGE_KEYS.USER_SIGN,
        formData.userSignature,
      );
    }
    if (formData.demandSignature) {
      localStorage.setItem(
        LOCAL_STORAGE_KEYS.DEMAND_SIGN,
        formData.demandSignature,
      );
    }

    const tx = db.transaction(INDEXED_DB_CONFIG.STORE_NAME, "readwrite");
    const store = tx.objectStore(INDEXED_DB_CONFIG.STORE_NAME);

    // 💡 request.onsuccess/onerror는 콜백이라 그냥 두면 이 함수가 실제 저장이 끝나기도
    // 전에 반환돼 버린다 — 호출부에서 await onSave() 후 다음 화면으로 넘어가는 순서를
    // 지키려면 저장이 끝날 때까지(그리고 alert을 닫을 때까지) 진짜로 기다려야 한다.
    const savedId = await new Promise<number | undefined>((resolve) => {
      const request = store.put(logItem);
      request.onsuccess = (event: Event) => {
        const target = event.target as IDBRequest;
        resolve(target.result as number);
      };
      request.onerror = (err) => {
        console.error("임시 저장 실패:", err);
        resolve(undefined);
      };
    });

    if (savedId === undefined) {
      await handleAlertModalOpen(["저장 중 오류가 발생했습니다."]);
      return;
    }

    // 💡 중요: 새로 생성된 글이라면 발급된 고유 id를 리액트 상태창고에도 업데이트해 줍니다.
    // 이렇게 해야 4페이지에서 또 저장하기를 눌러도 새로운 글로 복사되지 않고 수정 처리됩니다!
    setFormData((prev) => ({
      ...prev,
      id: savedId,
    }));

    await handleAlertModalOpen([
      "📝 현재까지 입력된 내용이 안전하게 저장되었습니다.",
    ]);

    // 💡 온라인이면 바로 서버 동기화 시도, 오프라인/실패 시 다음 기회(mount/online 이벤트)에 재시도
    syncPendingActivityLogs(db);
  };

  // 💡 앱이 처음 구동될 때 IndexedDB를 최초 1회 연결하는 이펙트
  useEffect(() => {
    // 1. 상수에 정의된 이름("SeniorActivityDB")과 버전(1)으로 DB 오픈
    const request = window.indexedDB.open(
      INDEXED_DB_CONFIG.DB_NAME,
      INDEXED_DB_CONFIG.DB_VERSION,
    );

    // 2. DB가 브라우저에 처음 생성되거나 버전이 바뀔 때 실행 (테이블 생성 단계)
    // 💡 event 타입을 IDBVersionChangeEvent로 정확하게 매핑
    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const target = event.target as IDBOpenDBRequest;
      const database: IDBDatabase = target.result;

      // 일지를 저장할 테이블("activity_logs")이 없으면 새로 만듭니다.
      if (!database.objectStoreNames.contains(INDEXED_DB_CONFIG.STORE_NAME)) {
        database.createObjectStore(INDEXED_DB_CONFIG.STORE_NAME, {
          keyPath: "id", // 고유 키값 이름
          autoIncrement: true, // 일지를 쓸 때마다 1, 2, 3... 자동으로 ID 증가
        });
      }
    };

    // 3. DB 연결에 성공했을 때 실행
    // 💡 event 타입을 표준 Event로 지정하고 OpenDBRequest로 안전하게 타겟팅
    request.onsuccess = (event: Event) => {
      console.log("🎯 IndexedDB 연결 성공!");
      const target = event.target as IDBOpenDBRequest;
      setDb(target.result); // 연결된 DB 객체를 상태에 보관
      syncPendingActivityLogs(target.result); // 지난번에 오프라인으로 남겨둔 기록 재시도
    };

    // 4. DB 연결에 실패했을 때 실행
    request.onerror = () => {
      console.error("❌ IndexedDB 연결 실패");
    };
  }, []);

  // 💡 오프라인 상태에서 저장해둔 기록을, 다시 온라인이 되는 순간 서버로 동기화
  useEffect(() => {
    if (!db) return;
    const handleNetworkOnline = () => syncPendingActivityLogs(db);
    window.addEventListener("online", handleNetworkOnline);
    return () => window.removeEventListener("online", handleNetworkOnline);
  }, [db]);

  // 💡 formData가 바뀔 때마다 draft를 저장해서 새로고침해도 참여자 식별/오늘 진행
  // 상황이 그대로 유지되도록 한다. 서명은 크기가 커서 별도 키(USER_SIGN/DEMAND_SIGN)로
  // 이미 캐싱되고 있으니 여기서는 제외한다.
  useEffect(() => {
    const { userSignature, demandSignature, ...draftFields } = formData;
    void userSignature;
    void demandSignature;
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.FORM_DRAFT,
      JSON.stringify(draftFields),
    );
  }, [formData]);

  // 💡 본인확인이 끝나고 db가 준비되면, 홈 대시보드가 "오늘 진행 상황"을 보여줄 수 있도록
  // 오늘 날짜로 이미 저장된 레코드가 있는지 확인해서 formData에 반영한다(없으면 오늘 날짜만
  // 채워서 새 레코드를 준비한다). id를 안 채우면 이후 저장 시 IndexedDB가 새로 발급한다.
  useEffect(() => {
    if (!db || !formData.participantId) return;
    const today = new Date().toISOString().slice(0, 10);
    if (formData.actDate === today) return;

    const tx = db.transaction(INDEXED_DB_CONFIG.STORE_NAME, "readonly");
    const request = tx.objectStore(INDEXED_DB_CONFIG.STORE_NAME).getAll();
    request.onsuccess = () => {
      const items: ActivityLogItem[] = request.result || [];
      const todayItem = items.find(
        (item) =>
          item.participantId === formData.participantId && item.date === today,
      );

      setFormData((prev) => ({
        ...prev,
        id: todayItem?.id,
        actDate: today,
        startTime: todayItem?.start
          ? hhmmToTimeParts(todayItem.start)
          : { ampm: "AM", hour: "", minute: "" },
        endTime: todayItem?.end
          ? hhmmToTimeParts(todayItem.end)
          : { ampm: "PM", hour: "", minute: "" },
        actTotalTime: todayItem?.totalTime || "- 시간",
        actContent: todayItem?.content || "",
        actPlace: todayItem?.place || "",
        hasAccident: todayItem?.accident === "유",
        accidentChecked: todayItem?.accidentChecked ?? false,
        accidentDetail: todayItem?.accidentDetail || "",
        accidentAction:
          (todayItem?.accidentAction as "귀가" | "업무수행" | undefined) ||
          "업무수행",
        userSignature: todayItem?.uSign || prev.userSignature,
        demandSignature: todayItem?.dSign || prev.demandSignature,
      }));
    };
  }, [db, formData.participantId, formData.actDate]);

  return (
    <div className="w-full h-full flex-shrink-0 flex justify-center items-stretch bg-[#f0f0f0] select-none">
      <div className="w-full h-full bg-white rounded-xl overflow-hidden flex flex-col items-stretch content-stretch relative box-border">
        {/* 1. 초기 설정 페이지 */}
        {view === VIEW_TYPE.AFFILIATION && (
          <AffiliationInputPage
            formData={formData}
            onChange={handleInputChange}
            onNext={() => setView(VIEW_TYPE.REGISTRATION_CONFIRM)}
            onAlert={handleAlertModalOpen}
          />
        )}

        {/* 2. 등록 확인 페이지 */}
        {view === VIEW_TYPE.REGISTRATION_CONFIRM && (
          <RegistrationConfirmPage
            formData={formData}
            onChange={handleInputChange}
            onBack={() => setView(VIEW_TYPE.AFFILIATION)}
            onNext={() => setView(VIEW_TYPE.HOME)}
          />
        )}

        {/* 홈 대시보드 */}
        {view === VIEW_TYPE.HOME && (
          <HomePage
            formData={formData}
            setFormData={setFormData}
            onBack={() => setView(VIEW_TYPE.AFFILIATION)}
            onAlert={handleAlertModalOpen}
            onSave={handleStepDataSave}
            onOpenAttendanceOut={() => setView(VIEW_TYPE.ATTENDANCE_OUT)}
            onOpenWork={() => setView(VIEW_TYPE.REPORT)}
            onOpenSafety={() => setView(VIEW_TYPE.ACCIDENT)}
            onOpenSummary={() => setView(VIEW_TYPE.SUMMARY)}
          />
        )}

        {/* 퇴근 모듈 */}
        {view === VIEW_TYPE.ATTENDANCE_OUT && (
          <AttendanceModulePage
            mode="out"
            formData={formData}
            setFormData={setFormData}
            onBack={() => setView(VIEW_TYPE.HOME)}
            onSave={handleStepDataSave}
            onHome={() => setView(VIEW_TYPE.HOME)}
            onAlert={handleAlertModalOpen}
          />
        )}

        {/* 업무 등록 모듈 */}
        {view === VIEW_TYPE.REPORT && (
          <ActivityReportPage
            formData={formData}
            setFormData={setFormData}
            onBack={() => setView(VIEW_TYPE.HOME)}
            onAlert={handleAlertModalOpen}
            onSave={handleStepDataSave}
            onNext={() => setView(VIEW_TYPE.HOME)}
          />
        )}

        {/* 안전 등록 모듈 */}
        {view === VIEW_TYPE.ACCIDENT && (
          <AccidentCheckPage
            formData={formData}
            setFormData={setFormData}
            onBack={() => setView(VIEW_TYPE.HOME)}
            onAlert={handleAlertModalOpen}
            onSave={handleStepDataSave}
            onNext={() => setView(VIEW_TYPE.HOME)}
          />
        )}

        {/* 전체확인(요약) 페이지 */}
        {view === VIEW_TYPE.SUMMARY && (
          <ActivitySummaryPage
            formData={formData}
            onBack={() => setView(VIEW_TYPE.HOME)}
            onNext={() => setView(VIEW_TYPE.SIGNATURE)}
          />
        )}

        {/* 서명하기 페이지 */}
        {view === VIEW_TYPE.SIGNATURE && (
          <SignaturePage
            formData={formData}
            setFormData={setFormData}
            onBack={() => setView(VIEW_TYPE.SUMMARY)}
            onAlert={handleAlertModalOpen}
            onSave={handleStepDataSave}
            onHome={() => setView(VIEW_TYPE.HOME)}
          />
        )}
      </div>

      {/* 알림 모달 */}
      <ConfirmModal
        isOpen={modalOpen}
        messages={modalMessages}
        onConfirm={handleAlertModalClose}
        onClose={handleAlertModalClose}
      />
    </div>
  );
};

export default Main;
