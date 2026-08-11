import type { ReactNode } from "react";
import { Building2 } from "lucide-react";

import type { ActivityLogFormData } from "../../types/form";

interface TodayStatus {
  isWorkDay: boolean;
  shiftStart: string | null;
  shiftEnd: string | null;
}

interface HomePageProps {
  formData: ActivityLogFormData;
  todayStatus: TodayStatus | null;
  onOpenAffiliation: () => void;
  onStartActivityLog: () => void;
}

interface HomeActionCardProps {
  onClick: () => void;
  iconSrc: string;
  title: string;
  description: ReactNode;
}

const WEEKDAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

const todayLabel = () => {
  const now = new Date();
  return `${now.getMonth() + 1}월 ${now.getDate()}일 ${WEEKDAY_LABEL[now.getDay()]}요일`;
};

const StatusPill = ({ label, active }: { label: string; active: boolean }) => (
  <div
    className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full flex-none ${
      active ? "bg-brand-tint text-brand" : "bg-surface-page text-[#6b7684]"
    }`}
  >
    <span className={`w-[5px] h-[5px] rounded-full ${active ? "bg-brand" : "bg-[#c7ccd4]"}`} />
    <p className="flex items-center text-center h-3.5 leading-[14px] mt-[1px]">{label}</p>
  </div>
);

/**
 * 앱 메인 페이지
 */
const HomePage = ({
  formData,
  todayStatus,
  onOpenAffiliation,
  onStartActivityLog,
}: HomePageProps) => {
  const attendanceInDone = formData.startTime.hour !== "";
  const attendanceOutDone = formData.endTime.hour !== "";
  const isWorking = attendanceInDone && !attendanceOutDone;
  // participantId는 있지만 서버 응답 전(로딩 중)엔 근무일로 가정해 기존 화면과 동일하게 보여준다.
  const isWorkDay = todayStatus?.isWorkDay ?? true;

  // 오늘 일지 진행 상황 — ActivityDashboardPage와 같은 순서(출근→업무일지→안전일지→퇴근→서명).
  // 역량 활동은 업무·안전 일지가 없어서 건너뛴다. 다음 단계 이름과 "n/총" 둘 다 보여준다.
  const isCompetencyProgram = formData.programType === "역량 활동";
  const workDone = !!formData.actContent && !!formData.actPlace;
  const safetyDone = formData.accidentChecked;
  // 서명은 매일 새로 받아야 해서(Main.tsx) 오늘 저장된 게 없으면 항상 비어있다.
  const signatureDone = !!formData.userSignature;
  const nextLogStep = !attendanceInDone
    ? "출근 대기"
    : !isCompetencyProgram && !workDone
      ? "업무일지 대기"
      : !isCompetencyProgram && !safetyDone
        ? "안전일지 대기"
        : !attendanceOutDone
          ? "퇴근 대기"
          : !signatureDone
            ? "서명 대기"
            : "완료";
  const totalLogSteps = isCompetencyProgram ? 3 : 5;
  const completedLogSteps =
    (attendanceInDone ? 1 : 0) +
    (isCompetencyProgram ? 0 : (workDone ? 1 : 0) + (safetyDone ? 1 : 0)) +
    (attendanceOutDone ? 1 : 0) +
    (signatureDone ? 1 : 0);
  const isLogComplete = nextLogStep === "완료";

  return (
    <div
      className="flex flex-col h-full min-h-0 flex-1 overflow-y-auto"
      style={{ background: "linear-gradient(180deg,#eaf2ff 0%,#f2f4f6 min(320px,60vh))" }}
    >
      <div className="h-[60px] flex items-center gap-2 px-[clamp(16px,5vw,24px)]">
        <span className="w-2 h-2 rounded-full bg-brand mb-[2px]" />
        <span className="leading-none text-[clamp(12px,3vw,13px)] font-extrabold tracking-[1.2px] text-text-tertiary">
          WORK REPORT
        </span>
      </div>

      <div className="flex-1 flex flex-col px-[clamp(16px,5vw,24px)] py-[clamp(12px,4vw,20px)]">
        <div className="mb-[clamp(20px,6vw,28px)]">
          <div className="text-left text-[clamp(19px,5.5vw,22px)] font-extrabold text-text-strong">
            {formData.userName ? `${formData.userName}님, 안녕하세요` : "참여자님, 안녕하세요"}
          </div>
          <div className="text-left text-[clamp(13px,3.6vw,14px)] text-text-muted font-semibold mt-1">
            오늘의 활동일지를 기록해볼까요?
          </div>
        </div>

        <div className="bg-white rounded-[18px] px-[clamp(16px,5vw,20px)] py-[clamp(15px,4.5vw,18px)] mb-[clamp(18px,5.5vw,24px)] shadow-[0_2px_8px_rgba(20,30,50,.05)]">
          {!formData.userName ? (
            <>
              <div className="text-[12.5px] font-bold text-text-muted mb-1">오늘의 근무</div>
              <div className="text-[14px] text-text-tertiary font-semibold leading-[1.6]">
                기본정보를 등록하면
                <br />
                오늘의 근무 상태를 보여드려요
              </div>
            </>
          ) : !formData.participantId ? (
            <>
              <div className="text-[12.5px] font-bold text-text-muted mb-1">오늘의 근무</div>
              <div className="text-[14px] text-text-tertiary font-semibold leading-[1.6]">
                참여자 확인이 필요해요
                <br />
                '활동일지 시작'에서 확인해주세요
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-[clamp(12px,3.5vw,14px)] text-left">
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex flex-col gap-1">
                  <span className="text-[12.5px] font-bold text-text-muted">오늘의 근무</span>
                  <span className="text-[clamp(15px,4vw,16px)] font-extrabold text-text-strong">
                    {todayLabel()}
                  </span>
                </div>
                <StatusPill
                  label={!isWorkDay ? "휴무" : isWorking ? "근무중" : "출근 전"}
                  active={isWorkDay && isWorking}
                />
              </div>

              {formData.programName && (
                <div className="flex items-center gap-2">
                  <div className="w-[clamp(22px,6vw,24px)] h-[clamp(22px,6vw,24px)] rounded-[8px] bg-brand-tint flex items-center justify-center flex-none">
                    <Building2 className="w-[55%] h-[55%] text-brand" strokeWidth={2.2} />
                  </div>
                  <span className="text-[clamp(14px,3.8vw,14.5px)] font-bold text-text-strong">
                    {formData.programName}
                  </span>
                </div>
              )}

              {!isWorkDay ? (
                <div className="bg-[#f7f9fb] rounded-[14px] px-[clamp(14px,4.5vw,16px)] py-[clamp(14px,4.5vw,16px)] text-[14px] font-bold text-text-muted text-center">
                  오늘은 근무일이 아니에요
                </div>
              ) : (
                <div className="flex gap-[clamp(8px,3vw,10px)]">
                  <div className="flex-1 bg-brand-tint rounded-[14px] px-[clamp(12px,4vw,16px)] py-[clamp(12px,3.5vw,14px)] flex flex-col gap-1">
                    <span className="text-[clamp(15px,4vw,16px)] font-extrabold text-brand">
                      {todayStatus?.shiftStart && todayStatus?.shiftEnd
                        ? `${todayStatus.shiftStart}~${todayStatus.shiftEnd}`
                        : "-"}
                    </span>
                    <span className="text-[12px] font-semibold text-[#6b9fe8]">근무 시간</span>
                  </div>
                  <div
                    className={`flex-1 rounded-[14px] px-[clamp(12px,4vw,16px)] py-[clamp(12px,3.5vw,14px)] flex flex-col gap-1 ${
                      isLogComplete ? "bg-green-tint" : "bg-[#f7f9fb]"
                    }`}
                  >
                    <span
                      className={`text-[clamp(13px,3.5vw,15px)] font-bold ${
                        isLogComplete ? "text-green" : "text-text-strong"
                      }`}
                    >
                      {nextLogStep}
                    </span>
                    <span
                      className={`text-[12px] font-semibold ${
                        isLogComplete ? "text-green" : "text-text-muted"
                      }`}
                    >
                      오늘 일지 {completedLogSteps}/{totalLogSteps}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-[clamp(10px,3.5vw,14px)]">
          <HomeActionCard
            onClick={onOpenAffiliation}
            iconSrc="/icon-basic-info.png"
            title="기본정보 등록"
            description={
              <>
                사업단 배정 전,
                <br />
                가장 먼저 등록하기
              </>
            }
          />
          <HomeActionCard
            onClick={onStartActivityLog}
            iconSrc="/icon-start-log.png"
            title="활동일지 시작"
            description={
              <>
                오늘의 출근부터,
                <br />
                차례로 기록하기
              </>
            }
          />
        </div>
        <div className="flex-1 min-h-[24px]" />
      </div>
    </div>
  );
};

const HomeActionCard = ({ onClick, iconSrc, title, description }: HomeActionCardProps) => (
  <button
    onClick={onClick}
    className="flex-1 min-w-0 bg-white rounded-[20px] px-[clamp(14px,4.5vw,18px)] py-[clamp(18px,5.5vw,22px)] flex flex-col items-start text-left cursor-pointer shadow-[0_8px_20px_rgba(20,30,60,.06)]"
  >
    <img
      src={iconSrc}
      className="w-[clamp(42px,10vw,80px)] h-[clamp(42px,10vw,80px)] object-contain mb-[clamp(12px,4vw,18px)]"
      alt=""
    />
    <span className="text-[clamp(16px,4.4vw,18px)] font-extrabold text-text-strong leading-[1.25]">
      {title}
    </span>
    <span className="text-[clamp(12.5px,3.3vw,14px)] text-text-muted font-medium leading-[1.5] mt-2.5">
      {description}
    </span>
  </button>
);

export default HomePage;
