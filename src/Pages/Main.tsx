import { useState, useEffect, useRef } from "react";

import ConfirmModal from "../components/molecule/ConfirmModal";

import Page1OnConfig from "./main_pages/Page1OnConfig";
import Page2Dashboard from "./main_pages/Page2Dashboard";
import Page3DateTime from "./main_pages/Page3DateTime";
import Page4ContentPlace from "./main_pages/Page4ContentPlace";
import Page5Accident from "./main_pages/Page5Accident";
import Page6Signature from "./main_pages/Page6Signature";
import { PdfTemplate } from "../components/organism/PdfTemplate";

import type { ActivityLogFormData, ActivityLogItem } from "../types/form";

import { INDEXED_DB_CONFIG, LOCAL_STORAGE_KEYS } from "../constants/storage";

// 💡 "AM 09:00" 같은 폼 표기를 "09:00" 24시간제 문자열로 변환
const formatTimeField = (time: ActivityLogFormData["startTime"]): string => {
  let hour24 = parseInt(time.hour, 10);
  if (time.ampm === "PM" && hour24 !== 12) hour24 += 12;
  if (time.ampm === "AM" && hour24 === 12) hour24 = 0;
  return `${String(hour24).padStart(2, "0")}:${time.minute}`;
};

// 💡 폼 데이터를 Page2Dashboard/PdfTemplate이 쓰는 ActivityLogItem 한 건으로 변환
const buildLogItemFromFormData = (
  formData: ActivityLogFormData,
): ActivityLogItem => ({
  ...(formData.id !== undefined && { id: formData.id }),
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
  projectName: "",
  demandName: "",
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
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<number>(1);

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

  const goNextStep = () => setPage((prev) => Math.min(prev + 1, 6));
  // const prevStep = () => setPage((prev) => Math.max(prev - 1, 1));

  const handleInputChange = <T extends keyof ActivityLogFormData>(
    field: T,
    value: ActivityLogFormData[T],
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: typeof value === "string" ? value : value,
    }));
  };

  const handleSaveStepData = () => {
    if (!db) {
      alert("데이터베이스가 연결되지 않았습니다.");
      return;
    }

    const tx = db.transaction(INDEXED_DB_CONFIG.STORE_NAME, "readwrite");
    const store = tx.objectStore(INDEXED_DB_CONFIG.STORE_NAME);

    // 💡 데이터 포맷 조립 (Page2Dashboard가 읽는 ActivityLogItem 스키마와 동기화)
    const logItem = buildLogItemFromFormData(formData);

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
    };

    // 4. DB 연결에 실패했을 때 실행
    request.onerror = () => {
      console.error("❌ IndexedDB 연결 실패");
    };
  }, []);

  return (
    <div className="w-full h-dvh flex justify-center items-stretch bg-[#f0f0f0] p-0 min-[601px]:p-4 select-none">
      <div className="w-full h-full bg-white rounded-xl overflow-hidden flex flex-col items-stretch content-stretch relative box-border max-[600px]:w-[calc(100%-20px)] max-[600px]:shadow-md max-[600px]:m-[12px_10px_0_10px]">
        {/* 1. 초기 설정 페이지 */}
        {page === 1 && (
          <Page1OnConfig
            formData={formData}
            onChange={handleInputChange}
            onNext={goNextStep}
            onAlert={openAlertModal}
          />
        )}

        {/* 2. 대시보드 페이지 */}
        {page === 2 && (
          <Page2Dashboard
            formData={formData}
            db={db}
            onNavigateToPage3={() => setPage(3)}
            onAlert={openAlertModal}
            setFormData={setFormData}
          />
        )}

        {/* 3. 활동 일시 페이지 */}
        {page === 3 && (
          <Page3DateTime
            formData={formData}
            setFormData={setFormData}
            onSave={handleSaveStepData}
            onNext={() => setPage(4)}
            onAlert={openAlertModal}
          />
        )}

        {/* 4. 활동 내용/장소 페이지 */}
        {page === 4 && (
          <Page4ContentPlace
            formData={formData}
            setFormData={setFormData}
            onAlert={openAlertModal}
            onSave={handleSaveStepData}
            onNext={() => setPage(5)}
          />
        )}

        {/* 5. 안전사고 유무 페이지 */}
        {page === 5 && (
          <Page5Accident
            formData={formData}
            setFormData={setFormData}
            onAlert={openAlertModal}
            onSave={handleSaveStepData}
            onNext={() => setPage(6)}
          />
        )}

        {/* 6. 서명하기 페이지 */}
        {page === 6 && (
          <>
            <Page6Signature
              formData={formData}
              setFormData={setFormData}
              printRef={printAreaRef}
              onAlert={openAlertModal}
              onSave={handleSaveStepData}
              onHome={() => setPage(1)}
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
