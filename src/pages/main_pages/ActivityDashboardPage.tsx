import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import type { ActivityLogFormData } from "../../types/form";
import AppBar from "../../components/molecule/AppBar";
import AttendanceTimeGuideModal from "../../components/molecule/AttendanceTimeGuideModal";
import ClockOutTooEarlyModal from "../../components/molecule/ClockOutTooEarlyModal";
import ClockInCompleteModal from "../../components/molecule/ClockInCompleteModal";
import ClockOutCompleteModal from "../../components/molecule/ClockOutCompleteModal";
import NotWorkDayModal from "../../components/molecule/NotWorkDayModal";
import ClockInRequiredModal from "../../components/molecule/ClockInRequiredModal";
import ClockOutRequiredModal from "../../components/molecule/ClockOutRequiredModal";
import { pageClass, bodyClass } from "../../components/atoms/classes";
import {
  adminRoleQueryOptions,
  ClockInError,
  clockInMutationOptions,
  ClockOutError,
  clockOutMutationOptions,
} from "../../utils/attendanceApi";
import { formatTimeField, isoToTimeParts } from "../../utils/timeFormat";
import { checkNativePushPermission, registerNativePush } from "../../utils/nativePushRegistration";

interface ActivityDashboardPageProps {
  formData: ActivityLogFormData;
  setFormData: React.Dispatch<React.SetStateAction<ActivityLogFormData>>;
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
}

type ModuleItemProps = {
  index: number;
  icon: string;
  category: string;
  title: string;
  status: string;
  done: boolean;
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
  highlighted,
  isPending,
  onClick,
}: ModuleItemProps) => (
  <div
    className={`bg-white rounded-2xl px-[18px] py-4 flex items-center justify-between gap-3 shadow-[0_1px_2px_rgba(20,30,50,0.04)] ${
      highlighted ? "border-[1.5px] border-[#eef6ff]" : ""
    }`}
  >
    <div className="flex items-center gap-3.5">
      <img src={icon} alt="" className="w-10 h-10 flex-none" />
      <div>
        <div className="text-[13px] font-extrabold text-[#3182f6] mb-1">
          {index}. {category}
        </div>
        <div className="text-[17px] font-extrabold text-[#1f2937]">{title}</div>
        <div className="text-[13.5px] text-[#9ca3af] font-semibold mt-0.5">{status}</div>
      </div>
    </div>
    <button
      onClick={onClick}
      disabled={isPending}
      className={`flex-none h-[42px] px-5 rounded-xl border-none text-[15px] font-extrabold ${
        isPending
          ? "bg-[#f2f4f6] text-[#9ca3af] cursor-default"
          : `cursor-pointer ${done ? "bg-[#f2f4f6] text-[#4e5968]" : "bg-[#3182f6] text-white"}`
      }`}
    >
      {isPending ? "확인 중" : done ? "확인" : "등록"}
    </button>
  </div>
);

/**
 * 근무 기록 대시보드 — 오늘의 출근/업무/안전/퇴근/서명을 모듈별로 등록·확인한다.
 * 공익 활동은 5개 모듈, 역량 활동은 업무/안전이 없어 3개 모듈만 보여준다.
 */
const ActivityDashboardPage = ({
  formData,
  setFormData,
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
}: ActivityDashboardPageProps) => {
  const isCompetencyProgram = formData.programType === "역량 활동";

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

  let moduleIndex = 1;

  return (
    <div className={pageClass}>
      <AppBar title="근무 기록" onHome={onHome} />
      <div className={bodyClass}>
        <div className="bg-white rounded-[18px] px-[22px] py-5 shadow-[0_2px_8px_rgba(20,30,50,0.05)]">
          <div className="text-[13px] text-[#9ca3af] font-bold mb-3.5">
            {todayLabel} · {formData.userName || "참여자"}님, 안녕하세요
          </div>
          <div className="flex items-center justify-between gap-2.5">
            <span className="text-[19px] font-extrabold text-[#1f2937]">{formData.orgName}</span>
            <span className="inline-flex text-[12px] font-extrabold px-[10px] py-1 rounded-xl bg-[#eef6ff] text-[#3182f6]">
              {formData.programType}
            </span>
          </div>
          <div className="text-[15px] text-[#4e5968] font-semibold mt-1.5">
            {formData.programName} · {formData.demandName}
          </div>
        </div>

        {notificationsBlocked && (
          <div className="bg-[#fef2f2] rounded-2xl px-[18px] py-3.5 border border-[#fecaca]">
            <span className="text-[13px] font-bold text-[#b91c1c]">
              🔕 알림이 꺼져 있어요 — 휴대폰 설정에서 이 앱의 알림을 켜야 재난 문자를 받을 수
              있어요.
            </span>
          </div>
        )}

        {(import.meta.env.DEV || isSuperAdmin) && (
          <div className="bg-[#fff7e6] rounded-2xl px-[18px] py-3.5 flex items-center gap-3 border border-[#ffe1a8]">
            <span className="text-[13px] font-extrabold text-[#b45309] flex-none">
              🧪 테스트용 날짜/시간
            </span>
            <input
              type="date"
              value={debugDate}
              onChange={(event) => setDebugDate(event.target.value)}
              className="flex-1 h-9 px-2 rounded-lg border border-[#ffe1a8] text-[14px] font-semibold text-[#1f2937] bg-white"
            />
            <input
              type="time"
              value={debugTime}
              onChange={(event) => setDebugTime(event.target.value)}
              className="flex-1 h-9 px-2 rounded-lg border border-[#ffe1a8] text-[14px] font-semibold text-[#1f2937] bg-white"
            />
            {(debugDate || debugTime) && (
              <button
                onClick={() => {
                  setDebugDate("");
                  setDebugTime("");
                }}
                className="flex-none h-9 px-3 rounded-lg border-none bg-white text-[13px] font-bold text-[#b45309] cursor-pointer"
              >
                초기화
              </button>
            )}
          </div>
        )}

        {/* 업무·안전 모듈은 역량활동에는 표시되지 않는다 */}
        <ModuleItem
          index={moduleIndex++}
          icon="/icon-checkin-clock.png"
          category="출근"
          title="출근 등록"
          status={
            attendanceInDone ? `${formatTimeField(formData.startTime)} 출근했어요` : "출근 전이에요"
          }
          done={attendanceInDone}
          isPending={clockInMutation.isPending}
          onClick={handleAttendanceInButtonClick}
        />

        {!isCompetencyProgram && (
          <ModuleItem
            index={moduleIndex++}
            icon="/icon-task.png"
            category="업무"
            title="업무 일지 등록"
            status={
              workDone ? `${formData.actContent} · ${formData.actPlace}` : "업무 일지 기록 전이에요"
            }
            done={workDone}
            onClick={handleOpenWorkButtonClick}
          />
        )}

        {!isCompetencyProgram && (
          <ModuleItem
            index={moduleIndex++}
            icon="/icon-safety.png"
            category="안전"
            title="안전 일지 등록"
            status={
              !safetyDone
                ? "안전 일지 기록 전이에요"
                : formData.hasAccident
                  ? "사고가 있었어요"
                  : "이상 없었어요"
            }
            done={safetyDone}
            onClick={handleOpenSafetyButtonClick}
          />
        )}

        <ModuleItem
          index={moduleIndex++}
          icon="/icon-checkout-clock.png"
          category="퇴근"
          title="퇴근 등록"
          status={
            attendanceOutDone ? `${formatTimeField(formData.endTime)} 퇴근했어요` : "퇴근 전이에요"
          }
          done={attendanceOutDone}
          isPending={clockOutMutation.isPending}
          onClick={handleAttendanceOutButtonClick}
        />

        <ModuleItem
          index={moduleIndex}
          icon="/icon-signature.png"
          category="서명"
          title="전체 확인·서명"
          status={signatureDone ? "서명 완료" : "최종 확인이 필요해요"}
          done={signatureDone}
          highlighted
          onClick={handleOpenSummaryButtonClick}
        />
      </div>

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
