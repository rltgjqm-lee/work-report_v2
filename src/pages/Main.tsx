import { useState, useEffect, useRef } from "react";

import ConfirmModal from "../components/molecule/ConfirmModal";

import AffiliationInputPage from "./main_pages/AffiliationInputPage";
import HomePage from "./main_pages/HomePage";
import ActivityLogPage from "./main_pages/ActivityLogPage";
import WorkHoursInputPage from "./main_pages/WorkHoursInputPage";
import ActivityReportPage from "./main_pages/ActivityReportPage";
import AccidentCheckPage from "./main_pages/AccidentCheckPage";
import SignaturePage from "./main_pages/SignaturePage";

import { PdfTemplate } from "../components/organism/PdfTemplate";
import type { TabKey } from "../components/molecule/TabBar";

import type { ActivityLogFormData, ActivityLogItem } from "../types/form";

import { INDEXED_DB_CONFIG, LOCAL_STORAGE_KEYS } from "../constants/storage";
import { syncPendingActivityLogs } from "../utils/activityLogSync";

const VIEW_TYPE = {
  AFFILIATION: "affiliation",
  HOME: "home",
  LOGS: "logs",
  WORK_HOURS: "workHours",
  REPORT: "report",
  ACCIDENT: "accident",
  SIGNATURE: "signature",
} as const;

export type View = (typeof VIEW_TYPE)[keyof typeof VIEW_TYPE];

// 💡 "AM 09:00" 같은 폼 표기를 "09:00" 24시간제 문자열로 변환
const formatTimeField = (time: ActivityLogFormData["startTime"]): string => {
  let hour24 = parseInt(time.hour, 10);
  if (time.ampm === "PM" && hour24 !== 12) hour24 += 12;
  if (time.ampm === "AM" && hour24 === 12) hour24 = 0;
  return `${String(hour24).padStart(2, "0")}:${time.minute}`;
};

// 💡 폼 데이터를 ActivityLogPage/PdfTemplate이 쓰는 ActivityLogItem 한 건으로 변환.
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
  actDate: "",
  startTime: { ampm: "AM", hour: "09", minute: "00" },
  endTime: { ampm: "PM", hour: "01", minute: "00" },
  actTotalTime: "- 시간",
  actContent: "",
  actPlace: "",
  hasAccident: false,
  accidentDetail: "",
  accidentAction: "업무수행",
  userSignature: "", // ⚠️ 주의: 아래 저장 로직과 서명 필드명을 일치시켜야 합니다.
  demandSignature: "",
  saveSignatureConsent: true,
};

const Main = () => {
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [view, setView] = useState<View>(VIEW_TYPE.AFFILIATION);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // 모달 상태
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessages, setModalMessages] = useState<string[]>([]);

  // 💡 이전에 저장해둔 서명이 있다면 불러와 그대로 재사용
  const [formData, setFormData] = useState<ActivityLogFormData>(() => ({
    ...initialFormData,
    userSignature: localStorage.getItem(LOCAL_STORAGE_KEYS.USER_SIGN) || "",
    demandSignature: localStorage.getItem(LOCAL_STORAGE_KEYS.DEMAND_SIGN) || "",
  }));

  // functions
  const openAlertModal = (messages: string[]) => {
    setModalMessages(messages);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
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

  // 💡 홈에서 "+ 오늘 활동 기록하기" 클릭 시 활동 관련 필드만 초기화하고 3단계로 진입.
  // id를 반드시 비워야 한다 — 안 그러면 이번에 저장할 때 지난 번(오늘 이미 작성한) 글의
  // IndexedDB 레코드를 그대로 덮어써서 이전 기록이 사라진다.
  const handleStartNewLog = () => {
    setFormData((prev) => ({
      ...prev,
      id: undefined,
      actDate: "",
      startTime: { ampm: "AM", hour: "", minute: "" },
      endTime: { ampm: "PM", hour: "", minute: "" },
      actTotalTime: "- 시간",
      actContent: "",
      actPlace: "",
      hasAccident: false,
      accidentDetail: "",
      accidentAction: "업무수행",
    }));
    setView(VIEW_TYPE.WORK_HOURS);
  };

  const handleChangeTab = (tab: TabKey) =>
    setView(tab === "list" ? VIEW_TYPE.LOGS : VIEW_TYPE.HOME);

  const handleSaveStepData = async () => {
    if (!db) {
      alert("데이터베이스가 연결되지 않았습니다.");
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

    // 💡 데이터 포맷 조립 (ActivityLogPage가 읽는 ActivityLogItem 스키마와 동기화)
    const logItem = buildLogItemFromFormData(formData, existing);

    // 💡 서명 재사용을 위해 localStorage에도 보관 (참여자 서명은 항상, 확인자 서명은 동의 시에만)
    if (formData.userSignature) {
      localStorage.setItem(
        LOCAL_STORAGE_KEYS.USER_SIGN,
        formData.userSignature,
      );
    }
    if (formData.demandSignature) {
      if (formData.saveSignatureConsent) {
        localStorage.setItem(
          LOCAL_STORAGE_KEYS.DEMAND_SIGN,
          formData.demandSignature,
        );
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEYS.DEMAND_SIGN);
      }
    }

    const tx = db.transaction(INDEXED_DB_CONFIG.STORE_NAME, "readwrite");
    const store = tx.objectStore(INDEXED_DB_CONFIG.STORE_NAME);
    const request = store.put(logItem);

    request.onsuccess = (event: Event) => {
      const target = event.target as IDBRequest;
      const savedId = target.result; // IndexedDB가 발급하거나 유지해 준 고유 ID

      // 💡 중요: 새로 생성된 글이라면 발급된 고유 id를 리액트 상태창고에도 업데이트해 줍니다.
      // 이렇게 해야 4페이지에서 또 저장하기를 눌러도 새로운 글로 복사되지 않고 수정 처리됩니다!
      setFormData((prev) => ({
        ...prev,
        id: savedId,
      }));

      alert("📝 현재까지 입력된 내용이 안전하게 저장되었습니다.");

      // 💡 온라인이면 바로 서버 동기화 시도, 오프라인/실패 시 다음 기회(mount/online 이벤트)에 재시도
      syncPendingActivityLogs(db);
    };

    request.onerror = (err) => {
      console.error("임시 저장 실패:", err);
      alert("저장 중 오류가 발생했습니다.");
    };
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
    const handleOnline = () => syncPendingActivityLogs(db);
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [db]);

  return (
    <div className="w-full min-h-dvh flex-shrink-0 flex justify-center items-stretch bg-[#f0f0f0] p-0 min-[601px]:p-4 select-none">
      <div className="w-full min-h-dvh bg-white rounded-xl overflow-hidden flex flex-col items-stretch content-stretch relative box-border max-[600px]:w-[calc(100%-20px)] max-[600px]:shadow-md max-[600px]:m-[12px_10px_0_10px]">
        {/* 1. 초기 설정 페이지 */}
        {view === VIEW_TYPE.AFFILIATION && (
          <AffiliationInputPage
            formData={formData}
            onChange={handleInputChange}
            onNext={() => setView("home")}
            onAlert={openAlertModal}
          />
        )}

        {/* 홈 */}
        {view === VIEW_TYPE.HOME && (
          <HomePage
            formData={formData}
            onStartNewLog={handleStartNewLog}
            onChangeTab={handleChangeTab}
          />
        )}

        {/* 활동 일지 목록 */}
        {view === VIEW_TYPE.LOGS && (
          <ActivityLogPage
            formData={formData}
            db={db}
            onChangeTab={handleChangeTab}
            onAlert={openAlertModal}
          />
        )}

        {/* 3. 활동 일시 페이지 */}
        {view === VIEW_TYPE.WORK_HOURS && (
          <WorkHoursInputPage
            formData={formData}
            setFormData={setFormData}
            onBack={() => setView("home")}
            onSave={handleSaveStepData}
            onNext={() => setView(VIEW_TYPE.REPORT)}
            onAlert={openAlertModal}
          />
        )}

        {/* 4. 활동 내용/장소 페이지 */}
        {view === VIEW_TYPE.REPORT && (
          <ActivityReportPage
            formData={formData}
            setFormData={setFormData}
            onBack={() => setView(VIEW_TYPE.WORK_HOURS)}
            onAlert={openAlertModal}
            onSave={handleSaveStepData}
            onNext={() => setView(VIEW_TYPE.ACCIDENT)}
          />
        )}

        {/* 5. 안전사고 유무 페이지 */}
        {view === VIEW_TYPE.ACCIDENT && (
          <AccidentCheckPage
            formData={formData}
            setFormData={setFormData}
            onBack={() => setView(VIEW_TYPE.REPORT)}
            onAlert={openAlertModal}
            onSave={handleSaveStepData}
            onNext={() => setView(VIEW_TYPE.SIGNATURE)}
          />
        )}

        {/* 6. 서명하기 페이지 */}
        {view === VIEW_TYPE.SIGNATURE && (
          <>
            <SignaturePage
              formData={formData}
              setFormData={setFormData}
              printRef={printAreaRef}
              onBack={() => setView(VIEW_TYPE.ACCIDENT)}
              onAlert={openAlertModal}
              onSave={handleSaveStepData}
              onHome={() => setView("home")}
            />
            {/* 💡 보고서 출력 버튼이 조준할 히든 인쇄용 템플릿 */}
            <PdfTemplate
              printRef={printAreaRef}
              formData={formData}
              filteredLogs={[buildLogItemFromFormData(formData)]}
            />
          </>
        )}
      </div>

      {/* 알림 모달 */}
      <ConfirmModal
        isOpen={modalOpen}
        messages={modalMessages}
        onConfirm={closeModal}
        onClose={closeModal}
      />
    </div>
  );
};

export default Main;
