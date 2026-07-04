import { useState, useEffect, useRef } from "react";

import ConfirmModal from "../components/molecule/ConfirmModal";

import Page1OnConfig from "./main_pages/Page1OnConfig";
import Page2Dashboard from "./main_pages/Page2Dashboard";
import Page3DateTime from "./main_pages/Page3DateTime";
import Page4ContentPlace from "./main_pages/Page4ContentPlace";
import Page5Accident from "./main_pages/Page5Accident";
import Page6Signature from "./main_pages/Page6Signature";

import type { ActivityLogFormData } from "../types/form";

import { INDEXED_DB_CONFIG } from "../constants/storage";

export interface SavedLogItem extends Partial<ActivityLogFormData> {
  date?: string; // DB 저장 시 쓰인 날짜 키값 대응
  timestamp?: number;
}

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

  const [formData, setFormData] =
    useState<ActivityLogFormData>(initialFormData);

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

    // 💡 데이터 포맷 조립 (formData 구조와 100% 동기화)
    const logItem: ActivityLogFormData = {
      // 💡 id가 있을 때만 객체에 주입 (수정 모드 방어벽)
      ...(formData.id !== undefined && { id: formData.id }),

      orgName: formData.orgName,
      projectName: formData.projectName,
      demandName: formData.demandName,
      userName: formData.userName,
      actDate: formData.actDate,
      startTime: { ...formData.startTime },
      endTime: { ...formData.endTime },
      actTotalTime: formData.actTotalTime,
      actContent: formData.actContent,
      actPlace: formData.actPlace,
      hasAccident: formData.hasAccident,
      accidentDetail: formData.accidentDetail,
      accidentAction: formData.accidentAction,
      userSignature: formData.userSignature || "",
      demandSignature: formData.demandSignature || "",
      saveSignatureConsent: formData.saveSignatureConsent,
    };

    // 🔥 핵심: 대시보드에서 기존 일지를 클릭해 수정하는 상황이거나,
    // 3페이지에서 4페이지로 넘어가며 연달아 '저장하기'를 누를 때 id를 유지시켜 덮어쓰기 유도
    if (formData.id !== undefined && formData.id !== null) {
      logItem.id = formData.id;
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
          <Page6Signature
            formData={formData}
            setFormData={setFormData}
            printRef={printAreaRef}
            onAlert={openAlertModal}
            onSave={handleSaveStepData}
            onHome={() => setPage(2)}
          />
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
