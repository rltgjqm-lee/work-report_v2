import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import type { ActivityLogFormData } from "../../types/form";
import { programTypeShortLabel } from "../../types/form";
import { formatTimeField, isoToTimeParts } from "../../utils/timeFormat";

import { bodyClass, pageClass } from "../../components/atoms/classes";

import {
  adminRoleQueryOptions,
  ClockInError,
  clockInMutationOptions,
  ClockOutError,
  clockOutMutationOptions,
  recordLocationConsentMutationOptions,
} from "../api/attendanceApi";
import AppBar from "../components/molecule/AppBar";
import AttendanceTimeGuideModal from "../components/molecule/AttendanceTimeGuideModal";
import ClockInCompleteModal from "../components/molecule/ClockInCompleteModal";
import ClockInRequiredModal from "../components/molecule/ClockInRequiredModal";
import ClockOutCompleteModal from "../components/molecule/ClockOutCompleteModal";
import ClockOutRequiredModal from "../components/molecule/ClockOutRequiredModal";
import ClockOutTooEarlyModal from "../components/molecule/ClockOutTooEarlyModal";
import LocationConsentModal from "../components/molecule/LocationConsentModal";
import NotWorkDayModal from "../components/molecule/NotWorkDayModal";
import { checkNativePushPermission, registerNativePush } from "../utils/nativePushRegistration";
import ActivityDashboardPageLargeFont from "./ActivityDashboardPageLargeFont";

interface ActivityDashboardPageProps {
  formData: ActivityLogFormData;
  setFormData: React.Dispatch<React.SetStateAction<ActivityLogFormData>>;
  todayStatus: { locationConsentAt: string | null } | null;
  onHome: () => void;
  onAlert: (messages: string[]) => Promise<void>;
  onSave: () => Promise<void>;
  onOpenWork: () => void;
  onOpenSafety: () => void;
  onOpenSummary: () => void;
  debugDate: string;
  setDebugDate: React.Dispatch<React.SetStateAction<string>>;
  debugTime: string;
  setDebugTime: React.Dispatch<React.SetStateAction<string>>;
  isLargeFontMode: boolean;
}

type ModuleItemProps = {
  index: number;
  icon: string;
  category: string;
  title: string;
  status: ReactNode;
  done: boolean;
  ready: boolean;
  highlighted?: boolean;
  isPending?: boolean;
  onClick: () => void;
};

const ModuleItem = ({
  index,
  icon,
  category,
  title,
  status,
  done,
  ready,
  highlighted,
  isPending,
  onClick,
}: ModuleItemProps) => (
  <div
    className={`bg-white rounded-2xl px-[18px] py-4 flex items-center justify-between gap-3 shadow-[0_1px_2px_rgba(20,30,50,0.04)] ${
      highlighted ? "border-[1.5px] border-brand-tint" : ""
    }`}
  >
    <div className="flex items-center gap-3.5">
      <img src={icon} alt="" className="w-10 h-10 flex-none" />
      <div>
        <div className="text-[13px] font-extrabold text-brand mb-1">
          {index}. {category}
        </div>
        <div className="text-[17px] font-extrabold text-text-strong">{title}</div>
        <div className="text-[13.5px] text-text-muted font-semibold mt-0.5">{status}</div>
      </div>
    </div>
    <button
      onClick={onClick}
      disabled={isPending}
      className={`flex-none h-[42px] px-5 rounded-xl text-[15px] font-extrabold cursor-pointer ${
        isPending
          ? "border-none bg-surface-page text-text-muted cursor-default"
          : done
            ? "border-none bg-surface-page text-text-tertiary"
            : ready
              ? "border-none bg-brand text-white"
              : "border border-border-default bg-white text-text-disabled"
      }`}
    >
      {isPending ? "확인 중" : done ? "확인" : "등록"}
    </button>
  </div>
);

/**
 * 근무 기록 대시보드 페이지입니다.
 * — 오늘의 출근/업무/안전/퇴근/서명을 모듈별로 등록·확인
 * - 공익 활동은 5개 모듈, 역량 활용은 업무/안전이 없어 3개 모듈만 노출
 */
const ActivityDashboardPage = ({
  formData,
  setFormData,
  todayStatus,
  onHome,
  onAlert,
  onSave,
  onOpenWork,
  onOpenSafety,
  onOpenSummary,
  debugDate,
  setDebugDate,
  debugTime,
  setDebugTime,
  isLargeFontMode,
}: ActivityDashboardPageProps) => {
  const isCompetencyProgram = formData.programType === "역량 활용";

  // 💡 출퇴근 날짜·시간 검증(±30분/종료 10분 전 등)을 테스트하기 위한 override(Main이
  // 소유 — "오늘 이미 출근했는지" 재조회도 같은 값을 써야 해서). 개발 빌드에선 항상
  // 보이고, 실서버에서는 통합관리자(SUPER_ADMIN)만 패널을 보여준다. 서버도 localhost
  // 요청이거나 통합관리자 세션일 때만 실제로 반영한다.
  const { data: adminRole } = useQuery(adminRoleQueryOptions);
  const isSuperAdmin = adminRole === "SUPER_ADMIN";

  // 💡 출근 등록은 별도 페이지 없이 즉시 서버에 기록하고 컨펌 모달로 결과만 보여준다.
  // setFormData 직후 곧바로 onSave()를 부르면 onSave가 아직 갱신 전 formData를 클로저로
  // 물고 있어서 방금 기록한 시각을 저장하지 못한다 — 상태 반영 → 재렌더까지 기다렸다가
  // effect에서 저장한다.
  const [pendingAttendanceInTime, setPendingAttendanceInTime] = useState<string | null>(null);
  const [pendingAttendanceOutTime, setPendingAttendanceOutTime] = useState<string | null>(null);

  // 💡 출퇴근 등록 시 현재 위치를 같이 보낸다.
  // mutationFn 안에서 측위(최대 10초)까지 하므로 isPending이 그 구간 전체를 커버한다.
  //  — 위치를 못 읽으면(권한 거부/실내) null로 진행한다
  //  - 출퇴근시 서버에 위치를 기록만 하고 위치로 출퇴근을 막지 않는다
  const clockInMutation = useMutation(clockInMutationOptions);
  const clockOutMutation = useMutation(clockOutMutationOptions);
  const locationConsentMutation = useMutation(recordLocationConsentMutationOptions);

  // 💡 출근 즉시 위치 확인(백그라운드 감시)이 시작되므로, 위치정보법상 수집 전 고지·동의가
  // 필요하다 — 서버에 동의 기록이 없는 최초 출근에서만 모달을 띄우고, 확인해야 출근
  // API를 호출한다. 이미 동의했으면(todayStatus.locationConsentAt) 매번 다시 묻지 않는다.
  const [locationConsentOpen, setLocationConsentOpen] = useState(false);

  // 💡 출근 시간대 안내는 일반 alert 모달로는 시간표(업무 시작/종료)를 못 보여줘서
  // AttendanceTimeGuideModal이라는 전용 모달로 따로 띄운다.
  const [timeGuide, setTimeGuide] = useState<{
    now: string;
    shiftStart: string;
    shiftEnd: string;
  } | null>(null);

  // 💡 근무일이 아닐 때도 일반 alert 대신 전용 아이콘 모달로 안내한다.
  const [notWorkDayOpen, setNotWorkDayOpen] = useState(false);

  // 💡 출근/퇴근을 먼저 해야 하는 안내도 일반 alert 대신 전용 아이콘 모달로 보여준다.
  const [clockInRequiredOpen, setClockInRequiredOpen] = useState(false);
  const [clockOutRequiredOpen, setClockOutRequiredOpen] = useState(false);

  // 💡 퇴근이 너무 이를 때도 마찬가지로 시간 부분만 강조해야 해서 전용 모달로 띄운다.
  const [clockOutTooEarlyShiftEnd, setClockOutTooEarlyShiftEnd] = useState<string | null>(null);

  // 💡 정상 퇴근 완료 안내도 시간 부분만 강조해야 해서 전용 모달로 띄운다.
  const [clockOutCompleteTime, setClockOutCompleteTime] = useState<string | null>(null);

  // 💡 정상 출근 완료 안내도 시간 부분만 강조해야 해서 전용 모달로 띄운다.
  const [clockInCompleteTime, setClockInCompleteTime] = useState<string | null>(null);

  // 💡 등록확인 화면(네이티브 푸시 등록 최초 시도 지점)은 참여자id가 로컬에 남으면
  // 활동일지 시작하기를 누를 때만 거치고, 최초 시도가 실패하면(권한 다이얼로그를
  // 놓치는 등) 재시도 기회가 없었다. 이 화면에 들어올 때마다 여기서 재시도한다.
  const [notificationsBlocked, setNotificationsBlocked] = useState(false);

  useEffect(() => {
    const { participantId, programId } = formData;
    if (!participantId || !programId) return;

    checkNativePushPermission().then((permission) => {
      setNotificationsBlocked(permission === "denied");
      if (permission !== "denied") {
        registerNativePush(programId, participantId);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.participantId, formData.programId]);

  useEffect(() => {
    if (!pendingAttendanceInTime) return;
    (async () => {
      await onSave();
      setClockInCompleteTime(pendingAttendanceInTime);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAttendanceInTime]);

  useEffect(() => {
    if (!pendingAttendanceOutTime) return;
    (async () => {
      await onSave();
      setClockOutCompleteTime(pendingAttendanceOutTime);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAttendanceOutTime]);

  const todayLabel = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}.${month}.${day}`;
  }, []);
  const attendanceInDone = formData.startTime.hour !== "";
  const attendanceOutDone = formData.endTime.hour !== "";
  const workDone = !!formData.actContent && !!formData.actPlace;
  const safetyDone = formData.accidentChecked;
  const signatureDone = !!formData.userSignature;

  // 💡 모듈은 순서대로 진행해야 한다.
  // — 출근 전엔 업무/안전/퇴근/전체확인 불가능 하고, 공익활동은 업무·안전을 마쳐야 퇴근·전체확인으로 넘어갈 수 있다.
  const handleAttendanceInButtonClick = () => {
    if (!formData.participantId) return;
    if (attendanceInDone) {
      setClockInCompleteTime(formatTimeField(formData.startTime));
      return;
    }
    if (todayStatus?.locationConsentAt) {
      submitClockIn();
      return;
    }

    setLocationConsentOpen(true);
  };

  const handleLocationConsentConfirm = () => {
    if (!formData.participantId) return;
    locationConsentMutation.mutate(formData.participantId, {
      onSuccess: () => {
        setLocationConsentOpen(false);
        submitClockIn();
      },
      onError: (error) => {
        onAlert([error instanceof Error ? error.message : "동의 저장에 실패했습니다"]);
      },
    });
  };

  const submitClockIn = () => {
    if (!formData.participantId) return;

    clockInMutation.mutate(
      {
        participantId: formData.participantId,
        debug: { date: debugDate || undefined, time: debugTime || undefined },
      },
      {
        onSuccess: (result) => {
          const startTime = isoToTimeParts(result.clockIn);
          setFormData((prev) => ({ ...prev, startTime }));
          setPendingAttendanceInTime(formatTimeField(startTime));
        },
        onError: (error) => {
          const body = error instanceof ClockInError ? error.body : null;
          if (body?.error === "TOO_EARLY") {
            const { now, shiftStart, shiftEnd } = body as Extract<
              typeof body,
              { error: "TOO_EARLY" }
            >;
            setTimeGuide({ now, shiftStart, shiftEnd });
            return;
          }
          if (body?.error === "NOT_WORK_DAY") {
            setNotWorkDayOpen(true);
            return;
          }
          if (body?.error === "OUTSIDE_AREA") {
            const { distanceM } = body as Extract<typeof body, { error: "OUTSIDE_AREA" }>;
            onAlert([
              "근무지 관제구역 밖에서는 출근할 수 없습니다.",
              ...(distanceM !== null ? [`구역까지 약 ${distanceM}m 남았습니다.`] : []),
            ]);
            return;
          }
          if (body?.error === "LOCATION_REQUIRED") {
            // 위치 동의 모달을 다시 띄워서 재시도할 수 있게 한다 — 확인을 누르면
            // handleLocationConsentConfirm이 다시 submitClockIn을 호출한다.
            onAlert(["위치 확인이 필요합니다.", "위치 접근을 허용한 뒤 다시 시도해주세요."]).then(
              () => setLocationConsentOpen(true),
            );
            return;
          }
          onAlert([error instanceof Error ? error.message : "출근 등록에 실패했습니다"]);
        },
      },
    );
  };

  const handleOpenWorkButtonClick = () => {
    if (!attendanceInDone) {
      setClockInRequiredOpen(true);
      return;
    }
    onOpenWork();
  };

  const handleOpenSafetyButtonClick = () => {
    if (!attendanceInDone) {
      setClockInRequiredOpen(true);
      return;
    }
    if (!workDone) {
      onAlert(["업무 일지 등록을 먼저 완료해주세요"]);
      return;
    }
    onOpenSafety();
  };

  const handleAttendanceOutButtonClick = () => {
    if (!attendanceInDone) {
      setClockInRequiredOpen(true);
      return;
    }
    if (!isCompetencyProgram && !workDone) {
      onAlert(["업무 일지 등록을 먼저 완료해주세요"]);
      return;
    }
    if (!isCompetencyProgram && !safetyDone) {
      onAlert(["안전 일지 등록을 먼저 완료해주세요"]);
      return;
    }
    if (attendanceOutDone) {
      setClockOutCompleteTime(formatTimeField(formData.endTime));
      return;
    }
    if (!formData.participantId) return;
    clockOutMutation.mutate(
      {
        participantId: formData.participantId,
        debug: { date: debugDate || undefined, time: debugTime || undefined },
      },
      {
        onSuccess: (result) => {
          const endTime = isoToTimeParts(result.clockOut);
          setFormData((prev) => ({ ...prev, endTime }));
          setPendingAttendanceOutTime(formatTimeField(endTime));
        },
        onError: (error) => {
          const body = error instanceof ClockOutError ? error.body : null;
          if (body?.error === "TOO_EARLY_OUT") {
            const { shiftEnd } = body as Extract<typeof body, { error: "TOO_EARLY_OUT" }>;
            setClockOutTooEarlyShiftEnd(shiftEnd);
            return;
          }
          onAlert([error instanceof Error ? error.message : "퇴근 등록에 실패했습니다"]);
        },
      },
    );
  };

  const handleOpenSummaryButtonClick = () => {
    if (!attendanceInDone) {
      setClockInRequiredOpen(true);
      return;
    }
    if (!isCompetencyProgram && !workDone) {
      onAlert(["업무 일지 등록을 먼저 완료해주세요"]);
      return;
    }
    if (!isCompetencyProgram && !safetyDone) {
      onAlert(["안전 일지 등록을 먼저 완료해주세요"]);
      return;
    }
    if (!attendanceOutDone) {
      setClockOutRequiredOpen(true);
      return;
    }
    if (signatureDone) {
      onAlert(["오늘 서명은 이미 완료했어요"]);
      return;
    }
    onOpenSummary();
  };

  const handleDebugDateTimeResetButtonClick = () => {
    setDebugDate("");
    setDebugTime("");
  };

  let moduleIndex = 1;

  // 💡 각 모듈 버튼을 눌렀을 때 실제로 동작(등록 화면 이동/기록)하는지, 아니면 앞 단계
  // 안내 모달만 뜨는지를 미리 계산해 "지금 할 일" 하나만 강조하고 나머지는 톤다운한다 —
  // handleOpenWorkButtonClick 등 클릭 핸들러의 가드 조건과 항상 같은 값이어야 한다.
  const canDoWork = attendanceInDone;
  const canDoSafety = attendanceInDone && workDone;
  const canClockOut = attendanceInDone && (isCompetencyProgram || (workDone && safetyDone));
  const canSign = canClockOut && attendanceOutDone;

  // 💡 업무·안전 모듈은 역량활용에는 표시되지 않는다 — 이 목록을 보통글씨/큰글씨 화면이
  // 같이 써서 "어떤 모듈이 몇 번째로 보이는지"가 두 화면에서 어긋나지 않게 한다.
  const modules: ModuleItemProps[] = [
    {
      index: moduleIndex++,
      icon: "/icons/icon-checkin-clock.png",
      category: "출근",
      title: "출근 등록",
      status: attendanceInDone
        ? `${formatTimeField(formData.startTime)} 출근했어요`
        : "출근 전이에요",
      done: attendanceInDone,
      ready: true,
      isPending: clockInMutation.isPending,
      onClick: handleAttendanceInButtonClick,
    },
    ...(!isCompetencyProgram
      ? [
          {
            index: moduleIndex++,
            icon: "/icons/icon-task.png",
            category: "업무",
            title: "업무 일지 등록",
            status: workDone ? (
              <>
                {formData.actContent}
                <br />
                {formData.actPlace}
              </>
            ) : (
              "업무 일지 기록 전이에요"
            ),
            done: workDone,
            ready: canDoWork,
            onClick: handleOpenWorkButtonClick,
          },
        ]
      : []),
    ...(!isCompetencyProgram
      ? [
          {
            index: moduleIndex++,
            icon: "/icons/icon-safety.png",
            category: "안전",
            title: "안전 일지 등록",
            status: !safetyDone
              ? "안전 일지 기록 전이에요"
              : formData.hasAccident
                ? "사고가 있었어요"
                : "이상 없었어요",
            done: safetyDone,
            ready: canDoSafety,
            onClick: handleOpenSafetyButtonClick,
          },
        ]
      : []),
    {
      index: moduleIndex++,
      icon: "/icons/icon-checkout-clock.png",
      category: "퇴근",
      title: "퇴근 등록",
      status: attendanceOutDone
        ? `${formatTimeField(formData.endTime)} 퇴근했어요`
        : "퇴근 전이에요",
      done: attendanceOutDone,
      ready: canClockOut,
      isPending: clockOutMutation.isPending,
      onClick: handleAttendanceOutButtonClick,
    },
    {
      index: moduleIndex,
      icon: "/icons/icon-signature.png",
      category: "서명",
      title: "전체 확인·서명",
      status: signatureDone ? "서명 완료" : "최종 확인이 필요해요",
      done: signatureDone,
      ready: canSign,
      highlighted: true,
      onClick: handleOpenSummaryButtonClick,
    },
  ];

  if (isLargeFontMode) {
    return (
      <>
        <ActivityDashboardPageLargeFont
          formData={formData}
          todayLabel={todayLabel}
          notificationsBlocked={notificationsBlocked}
          isDebugPanelVisible={import.meta.env.DEV || isSuperAdmin}
          debugDate={debugDate}
          setDebugDate={setDebugDate}
          debugTime={debugTime}
          setDebugTime={setDebugTime}
          onDebugDateTimeReset={handleDebugDateTimeResetButtonClick}
          modules={modules}
          onHome={onHome}
        />

        {locationConsentOpen && <LocationConsentModal onConfirm={handleLocationConsentConfirm} />}

        {notWorkDayOpen && <NotWorkDayModal onConfirm={() => setNotWorkDayOpen(false)} />}

        {clockInRequiredOpen && (
          <ClockInRequiredModal onConfirm={() => setClockInRequiredOpen(false)} />
        )}

        {clockOutRequiredOpen && (
          <ClockOutRequiredModal onConfirm={() => setClockOutRequiredOpen(false)} />
        )}

        {timeGuide && (
          <AttendanceTimeGuideModal
            now={timeGuide.now}
            shiftStart={timeGuide.shiftStart}
            shiftEnd={timeGuide.shiftEnd}
            onConfirm={() => setTimeGuide(null)}
          />
        )}

        {clockOutTooEarlyShiftEnd && (
          <ClockOutTooEarlyModal
            shiftEnd={clockOutTooEarlyShiftEnd}
            onConfirm={() => setClockOutTooEarlyShiftEnd(null)}
          />
        )}

        {clockOutCompleteTime && (
          <ClockOutCompleteModal
            endTime={clockOutCompleteTime}
            onConfirm={() => setClockOutCompleteTime(null)}
          />
        )}

        {clockInCompleteTime && (
          <ClockInCompleteModal
            startTime={clockInCompleteTime}
            onConfirm={() => setClockInCompleteTime(null)}
          />
        )}
      </>
    );
  }

  return (
    <div className={pageClass}>
      <AppBar title="근무 기록" onHome={onHome} participantId={formData.participantId} />
      <div className={bodyClass}>
        <div className="bg-white rounded-[18px] px-[22px] py-5 shadow-[0_2px_8px_rgba(20,30,50,0.05)]">
          <div className="text-[13px] text-text-muted font-bold mb-3.5">
            {todayLabel} · {formData.userName || "참여자"}님, 안녕하세요
          </div>
          <div className="flex items-center justify-between gap-2.5">
            <span className="text-[19px] font-extrabold text-text-strong">{formData.orgName}</span>
            <span className="inline-flex text-[12px] font-extrabold px-[10px] py-1 rounded-xl bg-brand-tint text-brand">
              {programTypeShortLabel(formData.programType)}
            </span>
          </div>
          <div className="text-[15px] text-text-tertiary font-semibold mt-1.5">
            {formData.programName} · {formData.demandName}
          </div>
        </div>

        {notificationsBlocked && (
          <div className="bg-danger-tint rounded-2xl px-[18px] py-3.5 border border-caution-border-subtle">
            <span className="text-[13px] font-bold text-danger-text-strong">
              🔕 알림이 꺼져 있어요 — 휴대폰 설정에서 이 앱의 알림을 켜야 재난 문자를 받을 수
              있어요.
            </span>
          </div>
        )}

        {(import.meta.env.DEV || isSuperAdmin) && (
          <div className="bg-badge-bg rounded-2xl px-[18px] py-3.5 flex items-center gap-3 border border-badge-border">
            <span className="text-[13px] font-extrabold text-caution-text flex-none">
              🧪 테스트용 날짜/시간
            </span>
            <input
              type="date"
              value={debugDate}
              onChange={(event) => setDebugDate(event.target.value)}
              className="flex-1 h-9 px-2 rounded-lg border border-badge-border text-[14px] font-semibold text-text-strong bg-white"
            />
            <input
              type="time"
              value={debugTime}
              onChange={(event) => setDebugTime(event.target.value)}
              className="flex-1 h-9 px-2 rounded-lg border border-badge-border text-[14px] font-semibold text-text-strong bg-white"
            />
            {(debugDate || debugTime) && (
              <button
                onClick={handleDebugDateTimeResetButtonClick}
                className="flex-none h-9 px-3 rounded-lg border-none bg-white text-[13px] font-bold text-caution-text cursor-pointer"
              >
                초기화
              </button>
            )}
          </div>
        )}

        {modules.map((module) => (
          <ModuleItem key={module.category} {...module} />
        ))}
      </div>

      {locationConsentOpen && <LocationConsentModal onConfirm={handleLocationConsentConfirm} />}

      {notWorkDayOpen && <NotWorkDayModal onConfirm={() => setNotWorkDayOpen(false)} />}

      {clockInRequiredOpen && (
        <ClockInRequiredModal onConfirm={() => setClockInRequiredOpen(false)} />
      )}

      {clockOutRequiredOpen && (
        <ClockOutRequiredModal onConfirm={() => setClockOutRequiredOpen(false)} />
      )}

      {timeGuide && (
        <AttendanceTimeGuideModal
          now={timeGuide.now}
          shiftStart={timeGuide.shiftStart}
          shiftEnd={timeGuide.shiftEnd}
          onConfirm={() => setTimeGuide(null)}
        />
      )}

      {clockOutTooEarlyShiftEnd && (
        <ClockOutTooEarlyModal
          shiftEnd={clockOutTooEarlyShiftEnd}
          onConfirm={() => setClockOutTooEarlyShiftEnd(null)}
        />
      )}

      {clockOutCompleteTime && (
        <ClockOutCompleteModal
          endTime={clockOutCompleteTime}
          onConfirm={() => setClockOutCompleteTime(null)}
        />
      )}

      {clockInCompleteTime && (
        <ClockInCompleteModal
          startTime={clockInCompleteTime}
          onConfirm={() => setClockInCompleteTime(null)}
        />
      )}
    </div>
  );
};

export default ActivityDashboardPage;
