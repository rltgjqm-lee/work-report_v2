import type { ReactNode } from "react";

import { Building2, Settings } from "lucide-react";

import type { ActivityLogFormData } from "../../types/form";

import { computeTodayWorkCardStatus, type TodayStatus } from "../utils/todayWorkStatus";

interface HomePageLargeFontProps {
  formData: ActivityLogFormData;
  todayStatus: TodayStatus | null;
  onOpenAffiliation: () => void;
  onStartActivityLog: () => void;
  onOpenSettings: () => void;
  onSosButtonClick: () => void;
  onExitLargeFontButtonClick: () => void;
}

interface ActionButtonLargeProps {
  onClick: () => void;
  title: string;
  description: ReactNode;
  variant: "primary" | "outline";
}

interface TodayWorkCardLargeProps {
  formData: ActivityLogFormData;
  todayStatus: TodayStatus | null;
}

// 홈 화면 큰글씨 버전 — 저시력 참여자를 위해 텍스트를 크게, 대비를 또렷하게 키운 스킨.
// 근무 상태 판단/버튼 동작은 일반 홈 화면(HomePage.tsx)과 완전히 동일하고 겉모습만 다르다.
const HomePageLargeFont = ({
  formData,
  todayStatus,
  onOpenAffiliation,
  onStartActivityLog,
  onOpenSettings,
  onSosButtonClick,
  onExitLargeFontButtonClick,
}: HomePageLargeFontProps) => (
  <div className="flex flex-col h-full min-h-0 flex-1 overflow-y-auto bg-white">
    <div className="flex-none bg-white border-b-2 border-[#e3e7ec] px-[clamp(18px,5.5vw,24px)] py-[clamp(14px,4vw,20px)] flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <img
          src="/icons/app-icon-64.png"
          alt=""
          className="w-[clamp(28px,7vw,34px)] h-[clamp(28px,7vw,34px)] rounded-[10px] flex-none"
        />
        <span className="text-[clamp(16px,4.5vw,21px)] font-black text-large-font-primary tracking-[0.02em]">
          WORK SAFE
        </span>
      </div>

      <div className="flex items-center gap-2.5 flex-none">
        <button
          onClick={onExitLargeFontButtonClick}
          className="h-[clamp(44px,12vw,56px)] px-[clamp(10px,3vw,14px)] rounded-[16px] border-2 border-large-font-border bg-white text-large-font-primary font-black text-[clamp(13px,3.6vw,16px)] flex items-center gap-1.5 cursor-pointer"
          aria-label="보통 글씨로 보기"
        >
          보통글씨
        </button>
        <button
          onClick={onOpenSettings}
          className="h-[clamp(44px,12vw,56px)] w-[clamp(44px,12vw,56px)] rounded-[16px] border-2 border-large-font-border bg-white text-large-font-primary flex items-center justify-center cursor-pointer flex-none"
          aria-label="설정"
        >
          <Settings size={22} strokeWidth={2.4} />
        </button>
      </div>
    </div>

    <div className="flex-1 flex flex-col px-[clamp(18px,5.5vw,24px)] py-[clamp(20px,6vw,28px)]">
      <div className="mb-[clamp(20px,6vw,28px)]">
        <div className="text-left text-[clamp(28px,9vw,44px)] font-black text-large-font-primary leading-[1.25] tracking-[-0.02em]">
          {formData.userName ? `${formData.userName}님,` : "참여자님,"}
          <br />
          안녕하세요
        </div>
        <div className="text-left text-[clamp(17px,5vw,24px)] font-bold text-large-font-text mt-3 leading-[1.5]">
          오늘의 활동일지를 기록해볼까요?
        </div>
      </div>

      <TodayWorkCardLarge formData={formData} todayStatus={todayStatus} />

      <div className="flex flex-col gap-[clamp(14px,4.5vw,18px)] mt-[clamp(20px,6vw,26px)]">
        <ActionButtonLarge
          onClick={onOpenAffiliation}
          title="기본정보 등록"
          description="가장 먼저 등록해주세요"
          variant="primary"
        />
        <ActionButtonLarge
          onClick={onStartActivityLog}
          title="활동일지 시작"
          description="출근부터 차례로 기록하기"
          variant="outline"
        />
      </div>

      <div className="flex-1 min-h-[24px]" />

      <SosButtonLarge onClick={onSosButtonClick} />
    </div>
  </div>
);

const StatusPillLarge = ({ label, active }: { label: string; active: boolean }) => (
  <div
    className={`flex items-center gap-2 rounded-full px-[clamp(12px,3.5vw,18px)] py-[clamp(6px,2vw,9px)] text-[clamp(14px,4vw,20px)] font-black flex-none border-2 ${
      active
        ? "bg-white border-large-font-working text-large-font-working"
        : "bg-large-font-bg border-[#8b94a1] text-large-font-primary"
    }`}
  >
    <span className={`w-[clamp(9px,2.5vw,13px)] h-[clamp(9px,2.5vw,13px)] rounded-full ${active ? "bg-large-font-working" : "bg-large-font-text"}`} />
    {label}
  </div>
);

const cardClassLarge =
  "bg-white border-2 border-large-font-border rounded-[20px] p-[clamp(18px,5.5vw,24px)]";

const TodayWorkCardLarge = ({ formData, todayStatus }: TodayWorkCardLargeProps) => {
  const status = computeTodayWorkCardStatus(formData, todayStatus);

  if (status.kind === "noUserName") {
    return (
      <div className={cardClassLarge}>
        <div className="text-[clamp(16px,4.5vw,22px)] font-black text-large-font-primary mb-2">
          오늘의 근무
        </div>
        <div className="text-[clamp(18px,5vw,26px)] font-bold text-large-font-text leading-[1.5]">
          기본정보를 등록하면
          <br />
          오늘의 근무 상태를 보여드려요
        </div>
      </div>
    );
  }

  if (status.kind === "noParticipantId") {
    return (
      <div className={cardClassLarge}>
        <div className="text-[clamp(16px,4.5vw,22px)] font-black text-large-font-primary mb-2">
          오늘의 근무
        </div>
        <div className="text-[clamp(18px,5vw,26px)] font-bold text-large-font-text leading-[1.5]">
          참여자 확인이 필요해요
          <br />
          '활동일지 시작'에서 확인해주세요
        </div>
      </div>
    );
  }

  const {
    dateLabel,
    statusLabel,
    isWorkDay,
    isWorking,
    programName,
    shiftLabel,
    nextLogStep,
    completedLogSteps,
    totalLogSteps,
    isLogComplete,
  } = status;

  return (
    <div className={cardClassLarge}>
      <div className="flex flex-col gap-[clamp(16px,4.5vw,20px)] text-left">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <span className="text-[clamp(16px,4.5vw,22px)] font-black text-large-font-primary">
              오늘의 근무
            </span>
            <span className="text-[clamp(20px,6vw,30px)] font-black text-large-font-primary">
              {dateLabel}
            </span>
          </div>
          <StatusPillLarge label={statusLabel} active={isWorkDay && isWorking} />
        </div>

        {programName && (
          <div className="flex items-center gap-3 border-t-2 border-large-font-bg pt-[clamp(14px,4vw,18px)]">
            <div className="w-[clamp(40px,11vw,52px)] h-[clamp(40px,11vw,52px)] rounded-[14px] bg-[#e8eef5] flex items-center justify-center flex-none">
              <Building2 className="w-[55%] h-[55%] text-large-font-primary" strokeWidth={2.2} />
            </div>
            <span className="text-[clamp(18px,5vw,26px)] font-black text-large-font-primary">
              {programName}
            </span>
          </div>
        )}

        {!isWorkDay ? (
          <div className="bg-large-font-bg rounded-[16px] p-[clamp(16px,5vw,20px)] text-center text-[clamp(16px,4.5vw,22px)] font-black text-large-font-primary">
            오늘은 근무일이 아니에요
          </div>
        ) : (
          <div className="flex flex-col gap-[clamp(10px,3vw,14px)]">
            <div className="bg-[#e8eef5] border-2 border-[#cbd7e4] rounded-[16px] px-[clamp(16px,4.5vw,20px)] py-[clamp(14px,4vw,18px)] flex items-center justify-between gap-3">
              <span className="text-[clamp(15px,4.2vw,19px)] font-bold text-[#3d566e]">
                근무 시간
              </span>
              <span className="text-[clamp(18px,5vw,26px)] font-black text-large-font-primary">
                {shiftLabel}
              </span>
            </div>
            <div
              className={`rounded-[16px] px-[clamp(16px,4.5vw,20px)] py-[clamp(14px,4vw,18px)] flex items-center justify-between gap-3 ${
                isLogComplete ? "bg-green-tint" : "bg-large-font-bg"
              }`}
            >
              <span
                className={`text-[clamp(15px,4.2vw,19px)] font-bold ${
                  isLogComplete ? "text-green" : "text-large-font-text"
                }`}
              >
                오늘 일지 {completedLogSteps}/{totalLogSteps}
              </span>
              <span
                className={`text-[clamp(18px,5vw,26px)] font-black ${
                  isLogComplete ? "text-green" : "text-large-font-primary"
                }`}
              >
                {nextLogStep}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ActionButtonLarge = ({ onClick, title, description, variant }: ActionButtonLargeProps) => (
  <button
    onClick={onClick}
    className={`w-full rounded-[22px] px-[clamp(20px,6vw,24px)] py-[clamp(20px,6vw,26px)] flex flex-col items-start gap-2 text-left cursor-pointer border-2 ${
      variant === "primary" ? "bg-brand border-[#1b6ae0]" : "bg-white border-large-font-border"
    }`}
  >
    <span
      className={`text-[clamp(24px,7.5vw,38px)] font-black leading-[1.2] ${
        variant === "primary" ? "text-white" : "text-[#3d566e]"
      }`}
    >
      {title}
    </span>
    <span
      className={`text-[clamp(14px,4vw,19px)] font-bold leading-[1.45] ${
        variant === "primary" ? "text-brand-tint" : "text-large-font-text"
      }`}
    >
      {description}
    </span>
  </button>
);

// SOS 버튼도 눌리는 동작(onSosButtonClick)은 일반 홈 화면과 동일하다 — 근무중이 아니거나
// 본인확인 전이면 HomePage가 적절한 안내 모달을 띄운다.
const SosButtonLarge = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="mt-[clamp(16px,5vw,22px)] w-full bg-white border-2 border-large-font-danger rounded-[22px] p-[clamp(18px,5.5vw,22px)] flex items-center justify-center gap-[clamp(12px,3.5vw,16px)] cursor-pointer"
  >
    <span className="w-[clamp(48px,13vw,60px)] h-[clamp(48px,13vw,60px)] rounded-full bg-large-font-danger text-white font-black text-[clamp(26px,7vw,32px)] flex items-center justify-center flex-none">
      !
    </span>
    <span className="flex flex-col items-start gap-1.5">
      <span className="text-[clamp(20px,6vw,28px)] font-black text-large-font-danger tracking-[0.02em]">
        SOS 긴급 도움
      </span>
      <span className="text-[clamp(14px,4vw,18px)] font-bold text-large-font-danger-text">
        위급할 때 눌러주세요
      </span>
    </span>
  </button>
);

export default HomePageLargeFont;
