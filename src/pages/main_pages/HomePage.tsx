import { useMemo } from "react";

import type { ActivityLogFormData } from "../../types/form";
import AppBar from "../../components/molecule/AppBar";
import { pageClass, bodyClass } from "../../components/atoms/classes";
import { formatTimeField } from "../../utils/timeFormat";

interface HomePageProps {
  formData: ActivityLogFormData;
  onOpenAttendanceIn: () => void;
  onOpenAttendanceOut: () => void;
  onOpenWork: () => void;
  onOpenSafety: () => void;
  onOpenSummary: () => void;
}

type ModuleItemProps = {
  index: number;
  title: string;
  status: string;
  done: boolean;
  highlighted?: boolean;
  onClick: () => void;
};

const ModuleItem = ({
  index,
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
        {index}.
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
  onOpenAttendanceIn,
  onOpenAttendanceOut,
  onOpenWork,
  onOpenSafety,
  onOpenSummary,
}: HomePageProps) => {
  const isCompetencyProgram = formData.programType === "역량 활동";

  const todayLabel = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}.${month}.${day}`;
  }, []);

  const programLabel = formData.programType
    ? `${formData.programType.replace(/\s/g, "")}사업`
    : "";

  const attendanceInDone = formData.startTime.hour !== "";
  const attendanceOutDone = formData.endTime.hour !== "";
  const workDone = !!formData.actContent && !!formData.actPlace;
  const safetyDone = formData.accidentChecked;
  const signatureDone = !!formData.userSignature;

  let moduleIndex = 1;

  return (
    <div className={pageClass}>
      <AppBar title="활동일지" />
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

        <ModuleItem
          index={moduleIndex++}
          title="출근 등록"
          status={
            attendanceInDone
              ? `${formatTimeField(formData.startTime)} 출근했어요`
              : "출근 전이에요"
          }
          done={attendanceInDone}
          onClick={onOpenAttendanceIn}
        />

        {!isCompetencyProgram && (
          <ModuleItem
            index={moduleIndex++}
            title="업무 일지 등록"
            status={
              workDone
                ? `${formData.actContent} · ${formData.actPlace}`
                : "업무 일지 기록 전이에요"
            }
            done={workDone}
            onClick={onOpenWork}
          />
        )}

        {!isCompetencyProgram && (
          <ModuleItem
            index={moduleIndex++}
            title="안전 일지 등록"
            status={
              !safetyDone
                ? "안전 일지 기록 전이에요"
                : formData.hasAccident
                  ? "사고가 있었어요"
                  : "이상 없었어요"
            }
            done={safetyDone}
            onClick={onOpenSafety}
          />
        )}

        <ModuleItem
          index={moduleIndex++}
          title="퇴근 등록"
          status={
            attendanceOutDone
              ? `${formatTimeField(formData.endTime)} 퇴근했어요`
              : "퇴근 전이에요"
          }
          done={attendanceOutDone}
          onClick={onOpenAttendanceOut}
        />

        <ModuleItem
          index={moduleIndex}
          title="전체확인·서명"
          status={signatureDone ? "서명 완료" : "최종 확인이 필요해요"}
          done={signatureDone}
          highlighted
          onClick={onOpenSummary}
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
