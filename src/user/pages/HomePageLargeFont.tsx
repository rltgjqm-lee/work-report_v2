import type { ReactNode } from "react";

import { Building2, ChevronRight, Settings } from "lucide-react";

import type { ActivityLogFormData } from "../../types/form";

import { computeTodayWorkCardStatus, type TodayStatus } from "../utils/todayWorkStatus";

interface HomePageLargeFontProps {
  formData: ActivityLogFormData;
  todayStatus: TodayStatus | null;
  onOpenAffiliation: () => void;
  onStartActivityLog: () => void;
  onOpenSettings: () => void;
  onToggleLargeFontMode: () => void;
  onSosButtonClick: () => void;
}

interface HomeActionCardLargeProps {
  onClick: () => void;
  iconSrc: string;
  title: string;
  description: ReactNode;
  primary?: boolean;
}

const StatusPillLarge = ({ label, active }: { label: string; active: boolean }) => (
  <div
    className={`flex items-center gap-1.5 text-[14px] font-bold px-3.5 py-1.5 rounded-full flex-none ${
      active ? "bg-brand-tint text-brand" : "bg-surface-page text-[#6b7684]"
    }`}
  >
    <span className={`w-[7px] h-[7px] rounded-full ${active ? "bg-brand" : "bg-[#c7ccd4]"}`} />
    <p className="flex items-center text-center h-4 leading-[16px] mb-[1px]">{label}</p>
  </div>
);

const cardLargeClass =
  "bg-white rounded-[18px] px-[20px] py-[16px] shadow-[0_2px_8px_rgba(20,30,50,.05)]";

const TodayWorkCardLarge = ({
  formData,
  todayStatus,
}: {
  formData: ActivityLogFormData;
  todayStatus: TodayStatus | null;
}) => {
  const status = computeTodayWorkCardStatus(formData, todayStatus);

  if (status.kind === "noUserName") {
    return (
      <div className={cardLargeClass}>
        <div className="text-[16px] font-bold text-text-muted mb-1.5">오늘의 근무</div>
        <div className="text-[18px] text-text-tertiary font-semibold leading-[1.6]">
          기본정보를 등록하면
          <br />
          오늘의 근무 상태를 보여드려요
        </div>
      </div>
    );
  }

  if (status.kind === "noParticipantId") {
    return (
      <div className={cardLargeClass}>
        <div className="text-[16px] font-bold text-text-muted mb-1.5">오늘의 근무</div>
        <div className="text-[18px] text-text-tertiary font-semibold leading-[1.6]">
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
    <div className={cardLargeClass}>
      <div className="flex flex-col gap-[clamp(15px,4.5vw,18px)] text-left">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[16px] font-bold text-text-muted">오늘의 근무</span>
            <span className="text-[clamp(20px,5.5vw,21px)] font-extrabold text-text-strong">
              {dateLabel}
            </span>
          </div>
          <StatusPillLarge label={statusLabel} active={isWorkDay && isWorking} />
        </div>

        {programName && <div className="border-t border-surface-page" />}

        {programName && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-[clamp(28px,7.8vw,31px)] h-[clamp(28px,7.8vw,31px)] rounded-[10px] bg-brand-tint flex items-center justify-center flex-none">
              <Building2 className="w-[55%] h-[55%] text-brand" strokeWidth={2.2} />
            </div>
            <span className="text-[clamp(18px,5vw,19px)] font-bold text-text-strong min-w-0">
              {programName}
            </span>
          </div>
        )}

        {!isWorkDay ? (
          <div className="bg-[#f7f9fb] rounded-[14px] px-[clamp(18px,5.9vw,21px)] py-[clamp(18px,5.9vw,21px)] text-[18px] font-bold text-text-muted text-center">
            오늘은 근무일이 아니에요
          </div>
        ) : (
          <div className="flex flex-col gap-[clamp(10px,3.9vw,13px)]">
            <div className="bg-[#f7f9fb] rounded-[14px] px-[clamp(16px,5.2vw,21px)] py-[clamp(11px,3.3vw,13px)] flex items-center justify-between gap-3">
              <span className="text-[15px] font-semibold text-text-muted">근무 시간</span>
              <span className="text-[clamp(17px,4.7vw,19px)] font-bold text-text-strong">
                {shiftLabel}
              </span>
            </div>
            <div
              className={`rounded-[14px] px-[clamp(16px,5.2vw,21px)] py-[clamp(11px,3.3vw,13px)] flex items-center justify-between gap-3 ${
                isLogComplete ? "bg-green-tint" : "bg-[#f7f9fb]"
              }`}
            >
              <span
                className={`text-[15px] font-semibold ${
                  isLogComplete ? "text-green" : "text-text-muted"
                }`}
              >
                오늘 일지 {completedLogSteps}/{totalLogSteps}
              </span>
              <span
                className={`text-[clamp(17px,4.7vw,19px)] font-bold ${
                  isLogComplete ? "text-green" : "text-text-strong"
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

const HomeActionCardLarge = ({
  onClick,
  iconSrc,
  title,
  description,
  primary,
}: HomeActionCardLargeProps) => {
  if (primary) {
    return (
      <button
        onClick={onClick}
        className="w-full min-w-0 bg-white rounded-[20px] px-[20px] py-[16px] flex items-center gap-5 text-left cursor-pointer shadow-[0_8px_20px_rgba(20,30,60,.06)]"
      >
        <img
          src={iconSrc}
          className="w-[clamp(55px,13vw,90px)] h-[clamp(55px,13vw,90px)] object-contain flex-none"
          alt=""
        />
        <div className="min-w-0">
          <span className="block text-[clamp(22px,6vw,25px)] font-extrabold text-text-strong leading-[1.25] break-keep">
            {title}
          </span>
          <span className="block text-[clamp(16px,4.3vw,18px)] text-text-muted font-medium leading-[1.5] mt-2 break-keep">
            {description}
          </span>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex-1 min-w-0 bg-white rounded-[20px] px-[clamp(18px,5.9vw,23px)] py-[clamp(23px,7.2vw,29px)] flex flex-col items-start text-left cursor-pointer shadow-[0_8px_20px_rgba(20,30,60,.06)]"
    >
      <img
        src={iconSrc}
        className="w-[clamp(55px,13vw,100px)] h-[clamp(55px,13vw,100px)] object-contain mb-[clamp(16px,5.2vw,23px)]"
        alt=""
      />
      <span className="text-[clamp(21px,5.7vw,23px)] font-extrabold text-text-strong leading-[1.25] break-keep">
        {title}
      </span>
      <span className="text-[clamp(16px,4.3vw,18px)] text-text-muted font-medium leading-[1.5] mt-3 break-keep">
        {description}
      </span>
    </button>
  );
};

const SecondaryLinkRowLarge = ({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="w-full bg-white rounded-[16px] px-[20px] py-[16px] flex items-center gap-[16px] cursor-pointer shadow-[0_2px_8px_rgba(20,30,50,.05)]"
  >
    {icon}
    <span className="flex-1 text-[18px] font-extrabold text-text-strong text-left">{label}</span>
    <ChevronRight size={20} color="#9ca3af" strokeWidth={2.2} />
  </button>
);

const SosButtonLarge = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-full rounded-[12px] px-[20px] py-[16px] flex flex-col items-center justify-center bg-white cursor-pointer shadow-[0_2px_8px_rgba(20,30,50,.05)]"
  >
    <div className="flex items-center gap-2.5">
      <span className="text-[26px] leading-none">🚨</span>
      <span className="text-[21px] font-extrabold tracking-[0.02em] text-text-tertiary">
        SOS 긴급 도움 요청
      </span>
    </div>
    <span className="text-[15px] font-semibold text-text-muted">위급 시에 버튼을 눌러주세요</span>
  </button>
);

// 메인 페이지 큰글씨 버전 — 보통글씨 버전(HomePage.tsx)과 배경·카드·버튼 색/모서리/그림자는
// 완전히 동일하고 글자·아이콘·여백 크기만 키운 스킨이다. SOS 확인/본인확인/근무중 아님
// 판단 로직은 HomePage가 그대로 소유하고 클릭 핸들러만 내려받는다. 오늘 근무 상태 판단은
// computeTodayWorkCardStatus 순수 함수를 여기서도 그대로 호출해 두 화면의 판정 기준이
// 어긋나지 않게 한다.
const HomePageLargeFont = ({
  formData,
  todayStatus,
  onOpenAffiliation,
  onStartActivityLog,
  onOpenSettings,
  onToggleLargeFontMode,
  onSosButtonClick,
}: HomePageLargeFontProps) => (
  <div className="flex flex-col bg-surface-page h-full min-h-0 flex-1 overflow-y-auto">
    <div className="flex-none sticky top-0 z-10 flex items-center justify-between gap-2 px-[16px] py-[10px] bg-white border-b border-surface-page">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <img src="/icons/app-icon-64.png" alt="" className="w-6 h-6 rounded-[7px]" />
          <p className="text-[14px] font-extrabold tracking-[1.2px] text-text-tertiary">
            WORK SAFE
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleLargeFontMode}
            className="h-[44px] px-3.5 rounded-[12px] border border-border-default bg-white text-[13px] font-bold text-text-tertiary cursor-pointer"
            aria-label="보통글씨로 보기"
          >
            보통글씨로
          </button>
        </div>
      </div>
    </div>

    <div className="flex-1 flex flex-col px-[16px] py-[20px]">
      <div className="mb-[clamp(26px,7.8vw,36px)] pl-[4px]">
        <div className="text-left text-[clamp(25px,7vw,29px)] font-extrabold text-text-strong">
          {formData.userName ? `${formData.userName}님, 안녕하세요` : "참여자님, 안녕하세요"}
        </div>
        <div className="text-left text-[clamp(17px,4.7vw,18px)] text-text-muted font-semibold mt-1.5">
          오늘의 활동일지를 기록해볼까요?
        </div>
      </div>

      <div className="flex flex-col gap-[16px]">
        <TodayWorkCardLarge formData={formData} todayStatus={todayStatus} />

        {formData.userName ? (
          <>
            <HomeActionCardLarge
              onClick={onStartActivityLog}
              iconSrc="/icons/icon-start-log.png"
              title="활동일지 시작"
              description={
                <>
                  오늘의 출근부터,
                  <br />
                  차례로 기록하기
                </>
              }
              primary
            />
            <SecondaryLinkRowLarge
              icon={
                <img
                  src="/icons/icon-basic-info.png"
                  alt=""
                  className="w-10 h-10 object-contain flex-none"
                />
              }
              label="기본정보 수정"
              onClick={onOpenAffiliation}
            />
            <SecondaryLinkRowLarge
              icon={
                <div className="w-10 h-10 rounded-[10px] bg-surface-page flex items-center justify-center flex-none">
                  <Settings size={22} color="#4e5968" strokeWidth={2.2} />
                </div>
              }
              label="설정"
              onClick={onOpenSettings}
            />
          </>
        ) : (
          <>
            <HomeActionCardLarge
              onClick={onOpenAffiliation}
              iconSrc="/icons/icon-basic-info.png"
              title="기본정보 등록"
              description={
                <>
                  사업단 배정 전,
                  <br />
                  가장 먼저 등록하기
                </>
              }
              primary
            />
            <SecondaryLinkRowLarge
              icon={
                <img
                  src="/icons/icon-start-log.png"
                  alt=""
                  className="w-10 h-10 object-contain flex-none"
                />
              }
              label="활동일지 시작"
              onClick={onStartActivityLog}
            />
            <SecondaryLinkRowLarge
              icon={
                <div className="w-10 h-10 rounded-[10px] bg-surface-page flex items-center justify-center flex-none">
                  <Settings size={22} color="#4e5968" strokeWidth={2.2} />
                </div>
              }
              label="설정"
              onClick={onOpenSettings}
            />
          </>
        )}

        <SosButtonLarge onClick={onSosButtonClick} />
      </div>

      <div className="flex-1 min-h-[24px]" />
    </div>
  </div>
);

export default HomePageLargeFont;
