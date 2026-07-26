import { useEffect, useMemo, useState } from "react";

import type { ActivityLogFormData } from "../../types/form";
import AppBar from "../../components/molecule/AppBar";
import { pageClass, bodyClass } from "../../components/atoms/classes";
import { clockIn, clockOut } from "../../utils/attendanceApi";
import { formatTimeField, isoToTimeParts } from "../../utils/timeFormat";

interface HomePageProps {
  formData: ActivityLogFormData;
  setFormData: React.Dispatch<React.SetStateAction<ActivityLogFormData>>;
  onBack: () => void;
  onAlert: (messages: string[]) => Promise<void>;
  onSave: () => Promise<void>;
  onOpenWork: () => void;
  onOpenSafety: () => void;
  onOpenSummary: () => void;
}

type ModuleItemProps = {
  index: number;
  category: string;
  title: string;
  status: string;
  done: boolean;
  highlighted?: boolean;
  onClick: () => void;
};

const ModuleItem = ({
  index,
  category,
  title,
  status,
  done,
  highlighted,
  onClick,
}: ModuleItemProps) => (
  <div
    className={`bg-white rounded-2xl px-[18px] py-4 flex items-center justify-between gap-3 shadow-[0_1px_2px_rgba(20,30,50,0.04)] ${
      highlighted ? "border-[1.5px] border-[#eef6ff]" : ""
    }`}
  >
    <div>
      <div className="text-[13px] font-extrabold text-[#3182f6] mb-1">
        {index}. {category}
      </div>
      <div className="text-[17px] font-extrabold text-[#1f2937]">{title}</div>
      <div className="text-[13.5px] text-[#9ca3af] font-semibold mt-0.5">
        {status}
      </div>
    </div>
    <button
      onClick={onClick}
      className={`flex-none h-[42px] px-5 rounded-xl border-none text-[15px] font-extrabold cursor-pointer ${
        done ? "bg-[#f2f4f6] text-[#4e5968]" : "bg-[#3182f6] text-white"
      }`}
    >
      {done ? "확인" : "등록"}
    </button>
  </div>
);

/**
 * 홈 대시보드 — 오늘의 출근/업무/안전/퇴근/서명을 모듈별로 등록·확인한다.
 * 공익 활동은 5개 모듈, 역량 활동은 업무/안전이 없어 3개 모듈만 보여준다.
 */
const HomePage = ({
  formData,
  setFormData,
  onBack,
  onAlert,
  onSave,
  onOpenWork,
  onOpenSafety,
  onOpenSummary,
}: HomePageProps) => {
  const isCompetencyProgram = formData.programType === "역량 활동";

  // 💡 로컬 개발 전용 — 출퇴근 시간 검증(±30분/종료 10분 전 등)을 실제 시각을
  // 기다리지 않고 테스트하기 위한 override. 서버가 localhost 요청에서만 실제로
  // 반영하므로 배포된 워커에는 아무 영향이 없다.
  const [debugTime, setDebugTime] = useState("");

  // 💡 출근 등록은 별도 페이지 없이 즉시 서버에 기록하고 컨펌 모달로 결과만 보여준다.
  // setFormData 직후 곧바로 onSave()를 부르면 onSave가 아직 갱신 전 formData를 클로저로
  // 물고 있어서 방금 기록한 시각을 저장하지 못한다 — 상태 반영 → 재렌더까지 기다렸다가
  // effect에서 저장한다.
  const [pendingAttendanceInTime, setPendingAttendanceInTime] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!pendingAttendanceInTime) return;
    (async () => {
      await onSave();
      await onAlert([
        `${pendingAttendanceInTime}에 정상적으로 출근 완료 됐어요`,
        "오늘도 안전하게 활동을 진행해주세요",
      ]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAttendanceInTime]);

  const [pendingAttendanceOutTime, setPendingAttendanceOutTime] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!pendingAttendanceOutTime) return;
    (async () => {
      await onSave();
      await onAlert([
        `${pendingAttendanceOutTime}에 정상적으로 퇴근 완료 됐어요`,
        "오늘도 수고하셨어요",
      ]);
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

  const programLabel = formData.programType
    ? `${formData.programType} 사업`
    : "";

  const attendanceInDone = formData.startTime.hour !== "";
  const attendanceOutDone = formData.endTime.hour !== "";
  const workDone = !!formData.actContent && !!formData.actPlace;
  const safetyDone = formData.accidentChecked;
  const signatureDone = !!formData.userSignature;

  const handleAttendanceInButtonClick = async () => {
    if (attendanceInDone) {
      await onAlert([
        `${formatTimeField(formData.startTime)}에 정상적으로 출근 완료 됐어요`,
        "오늘도 안전하게 활동을 진행해주세요",
      ]);
      return;
    }
    if (!formData.participantId) return;
    try {
      const result = await clockIn(
        formData.participantId,
        debugTime || undefined,
      );
      const startTime = isoToTimeParts(result.clockIn);
      setFormData((prev) => ({ ...prev, startTime }));
      setPendingAttendanceInTime(formatTimeField(startTime));
    } catch (error) {
      onAlert([
        error instanceof Error ? error.message : "출근 등록에 실패했습니다.",
      ]);
    }
  };

  // 💡 설계상 모듈은 순서대로 진행해야 한다 — 출근 전엔 업무/안전/퇴근/전체확인 모두
  // 막고, 공익활동은 업무·안전을 마쳐야 퇴근·전체확인으로 넘어갈 수 있다.
  const handleOpenWorkButtonClick = () => {
    if (!attendanceInDone) {
      onAlert(["출근 등록을 먼저 해주세요."]);
      return;
    }
    onOpenWork();
  };

  const handleOpenSafetyButtonClick = () => {
    if (!attendanceInDone) {
      onAlert(["출근 등록을 먼저 해주세요."]);
      return;
    }
    onOpenSafety();
  };

  const handleAttendanceOutButtonClick = async () => {
    if (!attendanceInDone) {
      onAlert(["출근 등록을 먼저 해주세요."]);
      return;
    }
    if (!isCompetencyProgram && !workDone) {
      onAlert(["업무 일지 등록을 먼저 완료해주세요."]);
      return;
    }
    if (!isCompetencyProgram && !safetyDone) {
      onAlert(["안전 일지 등록을 먼저 완료해주세요."]);
      return;
    }
    if (attendanceOutDone) {
      await onAlert([
        `${formatTimeField(formData.endTime)}에 정상적으로 퇴근 완료 됐어요`,
        "오늘도 수고하셨어요",
      ]);
      return;
    }
    if (!formData.participantId) return;
    try {
      const result = await clockOut(
        formData.participantId,
        debugTime || undefined,
      );
      const endTime = isoToTimeParts(result.clockOut);
      setFormData((prev) => ({ ...prev, endTime }));
      setPendingAttendanceOutTime(formatTimeField(endTime));
    } catch (error) {
      onAlert([
        error instanceof Error ? error.message : "퇴근 등록에 실패했습니다.",
      ]);
    }
  };

  const handleOpenSummaryButtonClick = () => {
    if (!attendanceInDone) {
      onAlert(["출근 등록을 먼저 해주세요."]);
      return;
    }
    if (!isCompetencyProgram && !workDone) {
      onAlert(["업무 일지 등록을 먼저 완료해주세요."]);
      return;
    }
    if (!isCompetencyProgram && !safetyDone) {
      onAlert(["안전 일지 등록을 먼저 완료해주세요."]);
      return;
    }
    if (!attendanceOutDone) {
      onAlert(["퇴근 등록을 먼저 완료해주세요."]);
      return;
    }
    onOpenSummary();
  };

  let moduleIndex = 1;

  return (
    <div className={pageClass}>
      <AppBar title="근무 기록" onBack={onBack} />
      <div className={bodyClass}>
        <div className="bg-white rounded-[20px] px-[22px] py-5 shadow-[0_1px_2px_rgba(20,30,50,0.04)]">
          <div className="text-[13px] text-[#9ca3af] font-bold mb-3.5">
            {todayLabel} · {formData.userName || "참여자"}님, 안녕하세요
          </div>
          <div className="flex items-center justify-between gap-2.5">
            <span className="text-[19px] font-extrabold text-[#1f2937]">
              {programLabel}
            </span>
          </div>
          <div className="text-[15px] text-[#4e5968] font-semibold mt-1.5">
            {formData.programName} 사업입니다.
          </div>
        </div>

        {import.meta.env.DEV && (
          <div className="bg-[#fff7e6] rounded-2xl px-[18px] py-3.5 flex items-center gap-3 border border-[#ffe1a8]">
            <span className="text-[13px] font-extrabold text-[#b45309] flex-none">
              🧪 테스트용 시간
            </span>
            <input
              type="time"
              value={debugTime}
              onChange={(event) => setDebugTime(event.target.value)}
              className="flex-1 h-9 px-2 rounded-lg border border-[#ffe1a8] text-[14px] font-semibold text-[#1f2937] bg-white"
            />
            {debugTime && (
              <button
                onClick={() => setDebugTime("")}
                className="flex-none h-9 px-3 rounded-lg border-none bg-white text-[13px] font-bold text-[#b45309] cursor-pointer"
              >
                초기화
              </button>
            )}
          </div>
        )}

        <ModuleItem
          index={moduleIndex++}
          category="출근"
          title="출근 등록"
          status={
            attendanceInDone
              ? `${formatTimeField(formData.startTime)} 출근했어요`
              : "출근 전이에요"
          }
          done={attendanceInDone}
          onClick={handleAttendanceInButtonClick}
        />

        {!isCompetencyProgram && (
          <ModuleItem
            index={moduleIndex++}
            category="업무"
            title="업무 일지 등록"
            status={
              workDone
                ? `${formData.actContent} · ${formData.actPlace}`
                : "업무 일지 기록 전이에요"
            }
            done={workDone}
            onClick={handleOpenWorkButtonClick}
          />
        )}

        {!isCompetencyProgram && (
          <ModuleItem
            index={moduleIndex++}
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
          category="퇴근"
          title="퇴근 등록"
          status={
            attendanceOutDone
              ? `${formatTimeField(formData.endTime)} 퇴근했어요`
              : "퇴근 전이에요"
          }
          done={attendanceOutDone}
          onClick={handleAttendanceOutButtonClick}
        />

        <ModuleItem
          index={moduleIndex}
          category="서명"
          title="전체 확인·서명"
          status={signatureDone ? "서명 완료" : "최종 확인이 필요해요"}
          done={signatureDone}
          highlighted
          onClick={handleOpenSummaryButtonClick}
        />

        {isCompetencyProgram && (
          <p className="text-center text-[13px] text-[#9ca3af] font-semibold">
            *업무·안전 모듈은 역량활동에는 표시되지 않아요
          </p>
        )}
      </div>
    </div>
  );
};

export default HomePage;
