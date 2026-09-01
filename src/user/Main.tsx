import { useCallback, useEffect, useRef, useState } from "react";

import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

import ConfirmModal from "../components/molecule/ConfirmModal";
import { INDEXED_DB_CONFIG, LOCAL_STORAGE_KEYS } from "../constants/storage";
import type { ActivityLogFormData, ActivityLogItem } from "../types/form";
import {
  formatTimeField,
  getLocalToday,
  hhmmToTimeParts,
  isoToTimeParts,
} from "../utils/timeFormat";
// import { findIncompleteActivityLogDate } from "./utils/activityLogSync"; // 💡 일단 주석 처리
import { getTodayAttendance } from "./api/attendanceApi";
import AccidentCheckPage from "./pages/AccidentCheckPage";
import ActivityDashboardPage from "./pages/ActivityDashboardPage";
import ActivityReportPage from "./pages/ActivityReportPage";
import ActivitySummaryPage from "./pages/ActivitySummaryPage";
// import IncompleteDayModal from "./components/molecule/IncompleteDayModal"; // 💡 일단 주석 처리

import LocationTrackingStatusBanner from "./components/molecule/LocationTrackingStatusBanner";
import AffiliationInputPage from "./pages/AffiliationInputPage";
import HomePage from "./pages/HomePage";
import RegistrationConfirmPage from "./pages/RegistrationConfirmPage";
import SettingsPage from "./pages/SettingsPage";
import SignaturePage from "./pages/SignaturePage";
import { syncPendingActivityLogs } from "./utils/activityLogSync";
import { readCurrentCoordinates } from "./utils/geolocation";
import {
  IDLE_LOCATION_REPORT_STATE,
  startLocationReporting,
  type LocationReportState,
} from "./utils/locationReporting";
import { requestNativePushPermission } from "./utils/nativePushRegistration";

const VIEW_TYPE = {
  MAIN: "main",
  AFFILIATION: "affiliation",
  REGISTRATION_CONFIRM: "registrationConfirm",
  DASHBOARD: "dashboard",
  REPORT: "report",
  ACCIDENT: "accident",
  SUMMARY: "summary",
  SIGNATURE: "signature",
  SETTINGS: "settings",
} as const;

type View = (typeof VIEW_TYPE)[keyof typeof VIEW_TYPE];

// 💡 화면별 "뒤로가기" 목적지 — 각 페이지의 onBack/onHome prop과 동일한 목적지를
// 안드로이드 하드웨어 뒤로가기 버튼에서도 그대로 재사용한다(아래 뒤로가기 버튼
// 리스너 effect). MAIN은 더 갈 곳이 없어 목록에서 뺐다 — 그때는 앱을 백그라운드로 보낸다.
const VIEW_BACK_TARGET: Partial<Record<View, View>> = {
  [VIEW_TYPE.AFFILIATION]: VIEW_TYPE.MAIN,
  [VIEW_TYPE.REGISTRATION_CONFIRM]: VIEW_TYPE.AFFILIATION,
  [VIEW_TYPE.DASHBOARD]: VIEW_TYPE.MAIN,
  [VIEW_TYPE.REPORT]: VIEW_TYPE.DASHBOARD,
  [VIEW_TYPE.ACCIDENT]: VIEW_TYPE.DASHBOARD,
  [VIEW_TYPE.SUMMARY]: VIEW_TYPE.DASHBOARD,
  [VIEW_TYPE.SIGNATURE]: VIEW_TYPE.SUMMARY,
  [VIEW_TYPE.SETTINGS]: VIEW_TYPE.MAIN,
};

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
  // 💡 앱을 켜면 누구나(첫 이용자 포함) 메인 페이지부터 본다.
  const [view, setView] = useState<View>(VIEW_TYPE.MAIN);

  // 💡 안드로이드 하드웨어 뒤로가기 버튼 — @capacitor/app의 backButton 이벤트를 직접
  // 받아서 처리한다. 기본 동작(WebView 히스토리를 따라가거나, 없으면 바로 앱을
  // 백그라운드로 보냄)은 이 앱처럼 라우팅 없이 view state만으로 화면을 바꾸는 구조와
  // 안 맞아서, 뒤로가기를 누르면 항상 이 리스너가 VIEW_BACK_TARGET을 보고 화면을
  // 옮긴다 — MAIN처럼 더 갈 곳이 없을 때만 원래처럼 앱을 백그라운드로 보낸다.
  // 웹(브라우저 미리보기)에서는 backButton 이벤트가 아예 발생하지 않으므로(네이티브
  // 전용), 실제 동작 확인은 안드로이드 빌드에서 해야 한다.
  // effect를 view가 바뀔 때마다 다시 등록하지 않도록 ref로 최신 view를 읽는다.
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    const listenerPromise = App.addListener("backButton", () => {
      const target = VIEW_BACK_TARGET[viewRef.current];
      if (target) {
        setView(target);
        return;
      }
      App.minimizeApp();
    });

    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, []);

  // 💡 앱을 켜자마자(참여자 확정 전이라도) 알림/위치 권한 다이얼로그를 먼저 띄운다 —
  // 그래야 이후 실제로 필요한 시점(출근 버튼, 등록확인)에 새삼 권한 팝업이 끼어들어
  // 흐름을 막지 않는다. 이미 허용/거부가 결정된 상태면 다이얼로그 없이 조용히 끝난다.
  // 네이티브 앱에서만 의미가 있어 웹 미리보기에서는 건너뛴다.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    requestNativePushPermission();
    readCurrentCoordinates();
  }, []);

  // 모달 상태
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessages, setModalMessages] = useState<string[]>([]);

  // 💡 앱을 켜자마자 한 번, 지난 날짜 중 아직 서버에 완료 처리되지 못한(=업무/안전/서명 중
  // 하나라도 빠진) 기록이 있으면 안내한다. — 일단 주석 처리.
  // const [incompleteDayDate, setIncompleteDayDate] = useState<string | null>(null);

  // 💡 서명은 매일 새로 받아야 하므로 이전 세션의 서명을 캐시에서 불러오지 않는다.
  const [formData, setFormData] = useState<ActivityLogFormData>(() => ({
    ...initialFormData,
    ...loadFormDraft(),
  }));

  // 💡 출퇴근 날짜·시간 검증을 테스트하기 위한 override. HomePage가 패널을 그리고
  // 출근/퇴근 등록에 쓰는데, "오늘 이미 출근했는지" 재조회(아래 getTodayAttendance)도
  // 같은 날짜 기준이어야 화면이 어긋나지 않아서 여기(Main)에서 소유하고 내려준다.
  const [debugDate, setDebugDate] = useState("");
  const [debugTime, setDebugTime] = useState("");

  // 💡 홈 화면의 "오늘의 상태" 카드용 — 오늘이 근무일인지/조 근무시간. formData(활동일지
  // 초안)와는 성격이 달라 별도 state로 둔다.
  const [todayStatus, setTodayStatus] = useState<{
    isWorkDay: boolean;
    shiftStart: string | null;
    shiftEnd: string | null;
    locationConsentAt: string | null;
  } | null>(null);

  // 💡 홈 화면에서 켜는 큰글씨 모드 — 설정 화면 등 다른 화면도 같은 값을 봐야 해서
  // (홈에서 켜면 설정으로 이동해도 자동으로 큰글씨여야 함) 화면별로 각자 들고 있지 않고
  // 여기(Main)에서 소유해 내려준다.
  const [isLargeFontMode, setIsLargeFontMode] = useState(() => {
    try {
      return localStorage.getItem(LOCAL_STORAGE_KEYS.LARGE_FONT_MODE) === "true";
    } catch {
      return false;
    }
  });

  const handleLargeFontModeToggle = () => {
    setIsLargeFontMode((previous) => {
      const next = !previous;
      try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.LARGE_FONT_MODE, String(next));
      } catch {
        // localStorage 접근 불가(프라이빗 모드 등)여도 화면 전환 자체는 계속 동작해야 한다.
      }
      return next;
    });
  };

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
      const database = target.result;
      setDb(database); // 연결된 DB 객체를 상태에 보관

      // 지난번에 오프라인으로 남겨둔 기록 재시도
      syncPendingActivityLogs(database);

      // 💡 미완료(=synced:false)로 남은 지난 날짜 기록 안내 모달 — 일단 주석 처리.
      // syncPendingActivityLogs(database).then(() => {
      //   if (!formData.participantId) return;
      //   findIncompleteActivityLogDate(database, formData.participantId, getLocalToday()).then(
      //     (date) => {
      //       if (date) setIncompleteDayDate(date);
      //     },
      //   );
      // });
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

  // 💡 formData가 바뀔 때마다가 아니라 단계(view)가 넘어갈 때만 draft를 저장한다 —
  // 각 페이지의 "다음/저장" 시점에 formData가 그 단계에서 확정된 상태이므로, 입력
  // 중간중간(키 입력마다)이 아니라 이 시점에 한 번씩만 저장해도 새로고침 시 참여자
  // 식별/오늘 진행 상황을 복원하는 데는 충분하다. 서명은 매일 새로 받아야 해서
  // draft에는 안 남긴다.
  useEffect(() => {
    const { userSignature, demandSignature, ...draftFields } = formData;
    void userSignature;
    void demandSignature;
    localStorage.setItem(LOCAL_STORAGE_KEYS.FORM_DRAFT, JSON.stringify(draftFields));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // 💡 본인확인이 끝나고 db가 준비되면, 홈 대시보드가 "오늘 진행 상황"을 보여줄 수 있도록
  // 오늘 날짜로 이미 저장된 레코드가 있는지 확인해서 formData에 반영한다(없으면 오늘 날짜만
  // 채워서 새 레코드를 준비한다). id를 안 채우면 이후 저장 시 IndexedDB가 새로 발급한다.
  // lastLoadedParticipantIdRef로 "같은 참여자의 날짜만 넘어간 경우"와 "같은 날 다른 참여자로
  // 바뀐 경우"를 구분한다 — actDate만 보면 후자를 걸러내지 못해서, 오늘 이미 A가 쓴 기기에서
  // B가 본인확인을 해도 A의 잔여 입력(서명 포함)이 그대로 남는 문제가 있었다.
  const lastLoadedParticipantIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!db || !formData.participantId) return;
    const today = getLocalToday();
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
    };
  }, [db, formData.participantId, formData.actDate]);

  // 💡 출근/퇴근의 진짜 소스는 서버(attendance_logs)다 — 브라우저 로컬 캐시가 없거나(다른
  // 기기, 캐시 유실 등) 어긋나도 화면이 항상 실제 출퇴근 상태와 맞도록 서버 조회 결과로
  // 덮어쓴다. 위 IndexedDB 복원 effect와 별도로 두고 debugDate/debugTime도 deps에 넣어서,
  // 테스트 패널에서 날짜를 바꾸면 그 날짜 기준으로 바로 다시 조회되게 한다.
  const refreshTodayAttendance = useCallback(() => {
    if (!formData.participantId) return;
    getTodayAttendance(formData.participantId, {
      date: debugDate || undefined,
      time: debugTime || undefined,
    })
      .then(({ clockIn, clockOut, isWorkDay, shiftStart, shiftEnd, locationConsentAt }) => {
        setFormData((prev) => ({
          ...prev,
          startTime: clockIn ? isoToTimeParts(clockIn) : { ampm: "AM", hour: "", minute: "" },
          endTime: clockOut ? isoToTimeParts(clockOut) : { ampm: "PM", hour: "", minute: "" },
        }));
        setTodayStatus({ isWorkDay, shiftStart, shiftEnd, locationConsentAt });
      })
      .catch(() => {
        // 네트워크 오류 등은 조용히 무시하고 로컬 캐시 값을 그대로 쓴다.
      });
  }, [formData.participantId, debugDate, debugTime]);

  useEffect(() => {
    refreshTodayAttendance();
  }, [refreshTodayAttendance]);

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

  // 💡 자동퇴근(worker/src/scheduled/autoClockOut.ts)은 조 근무 종료 시각 +10분
  // 유예(GRACE_MINUTES)가 지나야 처리되는, 시각이 정해진 일회성 이벤트다 — 폴링할
  // 필요 없이 "종료+10분(+크론 주기 1분 여유)" 딱 그 시점에 한 번만 다시 확인하면
  // 된다. 화면이 다시 보일 때(백그라운드→포그라운드)는 시각과 무관하게 그 즉시
  // 한 번 더 확인한다 — 비용이 거의 없는 이벤트 기반이라서다.
  useEffect(() => {
    if (!isWorking || !todayStatus?.shiftEnd) return;

    const [endHour, endMinute] = todayStatus.shiftEnd.split(":").map(Number);
    const autoClockOutCheckDate = new Date();
    autoClockOutCheckDate.setHours(endHour, endMinute + 11, 0, 0);
    const msUntilCheck = Math.max(0, autoClockOutCheckDate.getTime() - Date.now());

    const timeoutId = window.setTimeout(refreshTodayAttendance, msUntilCheck);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshTodayAttendance();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isWorking, todayStatus?.shiftEnd, refreshTodayAttendance]);

  return (
    <div className="w-full h-full flex-shrink-0 flex justify-center items-stretch bg-app-shell-bg select-none">
      <div className="w-full h-full bg-white rounded-xl overflow-hidden flex flex-col items-stretch content-stretch relative box-border">
        {isWorking && (
          <LocationTrackingStatusBanner
            escapedDemandSiteName={locationReportState.escapedDemandSiteName}
            reportFailing={locationReportState.reportFailing}
          />
        )}

        {/* 메인 페이지 */}
        {view === VIEW_TYPE.MAIN && (
          <HomePage
            formData={formData}
            todayStatus={todayStatus}
            onOpenAffiliation={() => setView(VIEW_TYPE.AFFILIATION)}
            onStartActivityLog={() => {
              // 💡 오늘 이미 출근을 했으면(서버 값 기준) 본인 확인은 그 출근 시점에 이미
              // 됐다고 보고, 다시 안 거치고 바로 대시보드로 보낸다 — 공유 기기 등에서의
              // 오인 방지용 재확인은 출근 전까지만 의미가 있다.
              if (formData.participantId && formData.startTime.hour !== "") {
                setView(VIEW_TYPE.DASHBOARD);
                return;
              }
              // 이름이 없으면 등록확인의 본인확인 쿼리가 disabled 상태로 멈춰서
              // "확인하는 중이에요"에서 영영 안 넘어간다 — 그 전에 기본정보 등록으로 보낸다.
              setView(formData.userName ? VIEW_TYPE.REGISTRATION_CONFIRM : VIEW_TYPE.AFFILIATION);
            }}
            onOpenSettings={() => setView(VIEW_TYPE.SETTINGS)}
            onToggleLargeFontMode={handleLargeFontModeToggle}
            isLargeFontMode={isLargeFontMode}
          />
        )}

        {/* 1. 초기 설정 페이지 */}
        {view === VIEW_TYPE.AFFILIATION && (
          <AffiliationInputPage
            formData={formData}
            onChange={handleInputChange}
            onBack={() => setView(VIEW_TYPE.MAIN)}
            onNext={() => setView(VIEW_TYPE.REGISTRATION_CONFIRM)}
            onAlert={handleAlertModalOpen}
          />
        )}

        {/* 2. 등록 확인 페이지 */}
        {view === VIEW_TYPE.REGISTRATION_CONFIRM && (
          <RegistrationConfirmPage
            formData={formData}
            onChange={handleInputChange}
            // 💡 본인확인 실패 시 바로 수정할 수 있어야 하므로, 홈이 아니라 기본정보
            // 입력 화면으로 돌아간다 — 홈으로 보내면 "기본정보 등록"을 한 번 더 눌러야 했다.
            onBack={() => setView(VIEW_TYPE.AFFILIATION)}
            // 💡 확인할 내용에 문제가 없을 땐 수정할 게 없으니, "이전"이 입력 화면을 다시
            // 거치지 않고 바로 홈으로 가게 한다.
            onHome={() => setView(VIEW_TYPE.MAIN)}
            onNext={() => setView(VIEW_TYPE.DASHBOARD)}
            isLargeFontMode={isLargeFontMode}
          />
        )}

        {/* 근무 기록 대시보드 */}
        {view === VIEW_TYPE.DASHBOARD && (
          <ActivityDashboardPage
            formData={formData}
            setFormData={setFormData}
            todayStatus={todayStatus}
            onHome={() => setView(VIEW_TYPE.MAIN)}
            onAlert={handleAlertModalOpen}
            onSave={handleStepDataSave}
            onOpenWork={() => setView(VIEW_TYPE.REPORT)}
            onOpenSafety={() => setView(VIEW_TYPE.ACCIDENT)}
            onOpenSummary={() => setView(VIEW_TYPE.SUMMARY)}
            debugDate={debugDate}
            setDebugDate={setDebugDate}
            debugTime={debugTime}
            setDebugTime={setDebugTime}
            isLargeFontMode={isLargeFontMode}
          />
        )}

        {/* 설정 */}
        {view === VIEW_TYPE.SETTINGS && (
          <SettingsPage
            todayStatus={todayStatus}
            participantId={formData.participantId}
            onBack={() => setView(VIEW_TYPE.MAIN)}
            isLargeFontMode={isLargeFontMode}
          />
        )}

        {/* 업무 등록 모듈 */}
        {view === VIEW_TYPE.REPORT && (
          <ActivityReportPage
            formData={formData}
            setFormData={setFormData}
            onBack={() => setView(VIEW_TYPE.DASHBOARD)}
            onAlert={handleAlertModalOpen}
            onSave={handleStepDataSave}
            onNext={() => setView(VIEW_TYPE.DASHBOARD)}
            isLargeFontMode={isLargeFontMode}
          />
        )}

        {/* 안전 등록 모듈 */}
        {view === VIEW_TYPE.ACCIDENT && (
          <AccidentCheckPage
            formData={formData}
            setFormData={setFormData}
            onBack={() => setView(VIEW_TYPE.DASHBOARD)}
            onAlert={handleAlertModalOpen}
            onSave={handleStepDataSave}
            onNext={() => setView(VIEW_TYPE.DASHBOARD)}
            isLargeFontMode={isLargeFontMode}
          />
        )}

        {/* 전체확인(요약) 페이지 */}
        {view === VIEW_TYPE.SUMMARY && (
          <ActivitySummaryPage
            formData={formData}
            onBack={() => setView(VIEW_TYPE.DASHBOARD)}
            onNext={() => setView(VIEW_TYPE.SIGNATURE)}
            isLargeFontMode={isLargeFontMode}
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
            onHome={() => setView(VIEW_TYPE.DASHBOARD)}
            isLargeFontMode={isLargeFontMode}
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

      {/* 💡 미완료 안내 모달 — 일단 주석 처리.
      {incompleteDayDate && (
        <IncompleteDayModal date={incompleteDayDate} onConfirm={() => setIncompleteDayDate(null)} />
      )} */}
    </div>
  );
};

export default Main;
