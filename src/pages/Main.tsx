import { useState, useEffect, useRef } from "react";

import ConfirmModal from "../components/molecule/ConfirmModal";

import AffiliationInputPage from "./main_pages/AffiliationInputPage";
import RegistrationConfirmPage from "./main_pages/RegistrationConfirmPage";
import HomePage from "./main_pages/HomePage";
import ActivityReportPage from "./main_pages/ActivityReportPage";
import AccidentCheckPage from "./main_pages/AccidentCheckPage";
import ActivitySummaryPage from "./main_pages/ActivitySummaryPage";
import SignaturePage from "./main_pages/SignaturePage";

import type { ActivityLogFormData, ActivityLogItem } from "../types/form";

import { INDEXED_DB_CONFIG, LOCAL_STORAGE_KEYS } from "../constants/storage";
import { syncPendingActivityLogs } from "../utils/activityLogSync";
import { getTodayAttendance } from "../utils/attendanceApi";
import {
  IDLE_LOCATION_REPORT_STATE,
  startLocationReporting,
  type LocationReportState,
} from "../utils/locationReporting";
import { formatTimeField, hhmmToTimeParts, isoToTimeParts } from "../utils/timeFormat";

const VIEW_TYPE = {
  AFFILIATION: "affiliation",
  REGISTRATION_CONFIRM: "registrationConfirm",
  HOME: "home",
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

  // 💡 서명은 매일 새로 받아야 하므로 이전 세션의 서명을 캐시에서 불러오지 않는다.
  const [formData, setFormData] = useState<ActivityLogFormData>(() => ({
    ...initialFormData,
    ...loadFormDraft(),
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

  // 💡 syncNow가 true일 때만(서명 완료 시점) 서버 동기화를 시도한다 — 그 전 단계(업무/안전
  // 등록, 출근/퇴근 직후)엔 activity_logs가 아직 필수값을 다 못 채운 상태라 매번 동기화를
  // 시도해봐야 서버 검증에 걸려 실패만 반복된다. IndexedDB 로컬 저장은 매 단계 그대로 한다.
  // (출근/퇴근 자체는 이 activity_logs 동기화와 별개로 attendanceApi의 clockIn/clockOut이
  // 등록 시점에 즉시 서버로 보낸다.)
  const handleStepDataSave = async (syncNow = false) => {
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

    // 💡 온라인이면 바로 서버 동기화 시도, 오프라인/실패 시 다음 기회(mount/online 이벤트)에 재시도
    if (syncNow) {
      syncPendingActivityLogs(db);
    }
  };

  // 💡 앱이 처음 구동될 때 IndexedDB를 최초 1회 연결하는 이펙트
  useEffect(() => {
    // 1. 상수에 정의된 이름("SeniorActivityDB")과 버전(1)으로 DB 오픈
    const request = window.indexedDB.open(INDEXED_DB_CONFIG.DB_NAME, INDEXED_DB_CONFIG.DB_VERSION);

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
  // 상황이 그대로 유지되도록 한다. 서명은 매일 새로 받아야 해서 draft에는 안 남긴다.
  useEffect(() => {
    const { userSignature, demandSignature, ...draftFields } = formData;
    void userSignature;
    void demandSignature;
    localStorage.setItem(LOCAL_STORAGE_KEYS.FORM_DRAFT, JSON.stringify(draftFields));
  }, [formData]);

  // 💡 본인확인이 끝나고 db가 준비되면, 홈 대시보드가 "오늘 진행 상황"을 보여줄 수 있도록
  // 오늘 날짜로 이미 저장된 레코드가 있는지 확인해서 formData에 반영한다(없으면 오늘 날짜만
  // 채워서 새 레코드를 준비한다). id를 안 채우면 이후 저장 시 IndexedDB가 새로 발급한다.
  // lastLoadedParticipantIdRef로 "같은 참여자의 날짜만 넘어간 경우"와 "같은 날 다른 참여자로
  // 바뀐 경우"를 구분한다 — actDate만 보면 후자를 걸러내지 못해서, 오늘 이미 A가 쓴 기기에서
  // B가 본인확인을 해도 A의 잔여 입력(서명 포함)이 그대로 남는 문제가 있었다.
  const lastLoadedParticipantIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!db || !formData.participantId) return;
    const today = new Date().toISOString().slice(0, 10);
    const isSameParticipant = lastLoadedParticipantIdRef.current === formData.participantId;
    if (formData.actDate === today && isSameParticipant) return;
    lastLoadedParticipantIdRef.current = formData.participantId;

    const tx = db.transaction(INDEXED_DB_CONFIG.STORE_NAME, "readonly");
    const request = tx.objectStore(INDEXED_DB_CONFIG.STORE_NAME).getAll();
    request.onsuccess = () => {
      const items: ActivityLogItem[] = request.result || [];
      const todayItem = items.find(
        (item) => item.participantId === formData.participantId && item.date === today,
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
          (todayItem?.accidentAction as "귀가" | "업무수행" | undefined) || "업무수행",
        // 💡 서명은 매일 새로 받아야 하므로 오늘 저장된 게 없으면 이전 값을 절대
        // 이어받지 않고 비운다(같은 참여자여도 예외 없음).
        userSignature: todayItem?.uSign || "",
        demandSignature: todayItem?.dSign || "",
      }));

      // 💡 출근/퇴근의 진짜 소스는 서버(attendance_logs)다 — 브라우저 로컬 캐시가
      // 없거나(다른 기기, 캐시 유실 등) 어긋나도 화면이 항상 실제 출퇴근 상태와
      // 맞도록, 위에서 로컬 값으로 채운 뒤 서버 조회 결과로 다시 덮어쓴다.
      getTodayAttendance(formData.participantId!)
        .then(({ clockIn, clockOut }) => {
          setFormData((prev) => ({
            ...prev,
            startTime: clockIn ? isoToTimeParts(clockIn) : { ampm: "AM", hour: "", minute: "" },
            endTime: clockOut ? isoToTimeParts(clockOut) : { ampm: "PM", hour: "", minute: "" },
          }));
        })
        .catch(() => {
          // 네트워크 오류 등은 조용히 무시하고 로컬 캐시 값을 그대로 쓴다.
        });
    };
  }, [db, formData.participantId, formData.actDate]);

  // 💡 근무 중(출근 완료 ~ 퇴근 전) 위치를 주기적으로 서버에 보고해 관제구역 이탈을
  // 판정받는다. 어느 화면에 있어도 계속 보고돼야 하므로 개별 페이지가 아니라 여기서 돌린다.
  // 앱이 화면에 보이는 동안만 동작한다 — 자세한 제약은 locationReporting.ts 참고.
  const isWorking = formData.startTime.hour !== "" && formData.endTime.hour === "";

  const [locationReportState, setLocationReportState] = useState<LocationReportState>(
    IDLE_LOCATION_REPORT_STATE,
  );

  useEffect(() => {
    if (!formData.participantId || !isWorking) return;

    const stopReporting = startLocationReporting(formData.participantId, setLocationReportState);
    // 보고를 멈출 때(퇴근/참여자 변경) 상태도 같이 비운다 — 안 그러면 다음에 출근할 때
    // 첫 보고가 도착하기 전까지 지난번 이탈/전송실패 배너가 그대로 남는다.
    return () => {
      stopReporting();
      setLocationReportState(IDLE_LOCATION_REPORT_STATE);
    };
  }, [formData.participantId, isWorking]);

  return (
    <div className="w-full h-full flex-shrink-0 flex justify-center items-stretch bg-[#f0f0f0] select-none">
      <div className="w-full h-full bg-white rounded-xl overflow-hidden flex flex-col items-stretch content-stretch relative box-border">
        {/* 근무 중 위치 관제 상태 — 이탈이 더 급한 정보라 둘 다일 때는 이탈만 보여준다.
            레이아웃을 밀지 않도록 화면 아래에 떠 있게 둔다. */}
        {isWorking &&
          (locationReportState.escapedDemandSiteName !== null ? (
            <div className="absolute bottom-0 left-0 right-0 z-50 px-4 py-3 bg-[#fef2f2] border-t border-[#fecaca] text-[13.5px] font-bold text-[#b91c1c]">
              ⚠️ {locationReportState.escapedDemandSiteName} 활동 구역을 벗어났어요 — 근무지로
              돌아가주세요
            </div>
          ) : (
            locationReportState.reportFailing && (
              <div className="absolute bottom-0 left-0 right-0 z-50 px-4 py-3 bg-[#fffbeb] border-t border-[#fde68a] text-[13.5px] font-bold text-[#b45309]">
                위치가 전송되지 않고 있어요 — 위치 권한과 네트워크를 확인해주세요
              </div>
            )
          ))}

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
            onOpenWork={() => setView(VIEW_TYPE.REPORT)}
            onOpenSafety={() => setView(VIEW_TYPE.ACCIDENT)}
            onOpenSummary={() => setView(VIEW_TYPE.SUMMARY)}
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
            onSave={() => handleStepDataSave(true)}
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
