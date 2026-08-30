import type { ReactNode } from "react";

import { Building2, ChevronRight } from "lucide-react";

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

const StatusPillLarge = ({ label, active }: { label: string; active: boolean }) => (
  <div
    className={`flex items-center gap-1.5 text-[13px] font-bold px-3.5 py-1.5 rounded-full flex-none ${
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
    return null;
  }

  if (status.kind === "noParticipantId") {
    return (
      <div className={cardLargeClass}>
        <div className="text-[14px] font-bold text-text-muted mb-1.5">오늘의 근무</div>
        <div className="text-[16px] text-text-tertiary font-semibold leading-[1.6]">
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
      <div className="flex flex-col gap-[12px] text-left">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0">
            <span className="text-[14px] font-medium text-text-subtitle">오늘의 근무</span>
            <span className="text-[clamp(18px,5vw,19px)] font-extrabold text-text-strong">
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
            <span className="text-[clamp(16px,4.5vw,17px)] font-bold text-text-strong min-w-0">
              {programName}
            </span>
          </div>
        )}

        {!isWorkDay ? (
          <div className="bg-[#f7f9fb] rounded-[14px] px-[clamp(18px,5.9vw,21px)] py-[clamp(18px,5.9vw,21px)] text-[16px] font-bold text-text-muted text-center">
            오늘은 근무일이 아니에요
          </div>
        ) : (
          <div className="rounded-[14px] bg-[#f7f9fb] overflow-hidden">
            <div className="px-[clamp(16px,5.2vw,21px)] py-[10px] flex items-center justify-between gap-3">
              <span className="text-[14px] font-semibold text-text-subtitle">근무 시간</span>
              <span className="text-[clamp(15px,4.2vw,17px)] font-bold text-text-strong">
                {shiftLabel}
              </span>
            </div>
            <div className="border-t border-white" />
            <div className="px-[clamp(16px,5.2vw,21px)] py-[10px] flex items-center justify-between gap-3">
              <span
                className={`text-[14px] font-semibold ${
                  isLogComplete ? "text-green" : "text-text-subtitle"
                }`}
              >
                오늘 일지 {completedLogSteps}/{totalLogSteps}
              </span>
              <span
                className={`text-[clamp(15px,4.2vw,17px)] font-bold ${
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

const PrimaryActionCardLarge = ({
  onClick,
  title,
  subtitle,
  ctaLabel,
}: {
  onClick: () => void;
  title: string;
  subtitle: string;
  ctaLabel?: string;
}) => (
  <button
    onClick={onClick}
    className={`w-full min-w-0 bg-brand rounded-[16px] px-[20px] py-[16px] text-left cursor-pointer shadow-[0_8px_20px_rgba(49,130,246,.25)] ${
      ctaLabel ? "flex flex-col items-start" : "flex items-center justify-between gap-3"
    }`}
  >
    <div className="flex flex-col items-start min-w-0">
      <span className="text-[clamp(23px,6.2vw,26px)] font-extrabold text-white leading-[1.25] break-keep">
        {title}
      </span>
      <span className="mt-1.5 text-[15px] text-white/80 font-semibold leading-[1.5] break-keep">
        {subtitle}
      </span>
    </div>
    {ctaLabel ? (
      <span className="self-end mt-4 px-4 py-2 rounded-full bg-white text-brand text-[14px] font-extrabold">
        {ctaLabel}
      </span>
    ) : (
      <ChevronRight size={20} color="#ffffff" strokeWidth={2.2} className="flex-none" />
    )}
  </button>
);

const SecondaryLinkRowLarge = ({
  icon,
  label,
  description,
  onClick,
  tone = "default",
  chevron = true,
}: {
  icon?: ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
  tone?: "default" | "danger";
  chevron?: boolean;
}) => (
  <button
    onClick={onClick}
    className="w-full rounded-[16px] px-[20px] py-[16px] flex items-center gap-[16px] cursor-pointer bg-white shadow-[0_2px_8px_rgba(20,30,50,.05)]"
  >
    {icon}
    <div className="flex-1 min-w-0 text-left">
      <span
        className={`block text-[18px] font-extrabold ${
          tone === "danger" ? "text-danger-text-strong" : "text-text-strong"
        }`}
      >
        {label}
      </span>
      {description && (
        <span className="block text-[14px] text-text-subtitle font-normal mt-1 break-keep">
          {description}
        </span>
      )}
    </div>
    {chevron && (
      <ChevronRight
        size={20}
        color={tone === "danger" ? "#b91c1c" : "#9ca3af"}
        strokeWidth={2.2}
      />
    )}
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
    <div className="flex-none sticky top-0 z-10 flex items-center justify-between gap-2 px-[16px] py-[10px] bg-surface-page">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center h-[44px] p-1 gap-1 rounded-[12px] bg-surface-page border border-border-default">
          <button
            onClick={onToggleLargeFontMode}
            className="h-full px-3.5 rounded-[9px] text-[13px] font-bold text-text-muted cursor-pointer"
            aria-label="보통 글씨로 보기"
          >
            기본
          </button>
          <span className="h-full px-3.5 rounded-[9px] bg-white shadow-[0_1px_2px_rgba(20,30,50,0.08)] text-[13px] font-bold text-text-strong flex items-center">
            큰 글씨
          </span>
        </div>

        <button
          onClick={onOpenSettings}
          className="h-[44px] px-2 flex items-center justify-center text-[15px] font-bold text-text-strong cursor-pointer"
          aria-label="설정"
        >
          설정
        </button>
      </div>
    </div>

    <div className="flex-1 flex flex-col px-[16px] pt-[8px] pb-[20px]">
      <div className="mb-[clamp(26px,7.8vw,36px)] pl-[4px]">
        <div className="text-left text-[clamp(25px,7vw,29px)] font-extrabold text-text-strong">
          {formData.userName ? `${formData.userName}님, 안녕하세요` : "참여자님, 안녕하세요"}
        </div>
        <div className="text-left text-[clamp(17px,4.7vw,18px)] text-text-subtitle font-medium mt-1">
          오늘의 활동일지를 기록해볼까요?
        </div>
      </div>

      <div className="flex flex-col gap-[12px]">
        <TodayWorkCardLarge formData={formData} todayStatus={todayStatus} />

        {formData.userName ? (
          <>
            <PrimaryActionCardLarge
              onClick={onStartActivityLog}
              title="활동일지"
              subtitle="오늘의 출근부터, 차례대로 기록해요"
              ctaLabel="기록"
            />
            <SecondaryLinkRowLarge
              icon={
                <img
                  src="/icons/icon-basic-info.png"
                  alt=""
                  className="w-[46px] h-[46px] object-contain flex-none"
                />
              }
              label="기본정보 수정"
              description="등록한 내 정보를 확인하고 수정해요"
              onClick={onOpenAffiliation}
              chevron={false}
            />
          </>
        ) : (
          <>
            <PrimaryActionCardLarge
              onClick={onOpenAffiliation}
              title="기본정보 등록"
              subtitle="처음 한 번만, 내 정보를 등록해요"
              ctaLabel="시작"
            />
            <SecondaryLinkRowLarge
              icon={
                <img
                  src="/icons/icon-start-log.png"
                  alt=""
                  className="w-[46px] h-[46px] object-contain flex-none"
                />
              }
              label="활동일지 시작"
              description="오늘의 출근부터, 차례대로 기록해요"
              onClick={onStartActivityLog}
              chevron={false}
            />
          </>
        )}

        <SecondaryLinkRowLarge
          icon={
            <span className="w-[46px] h-[46px] rounded-[13px] bg-danger-tint flex items-center justify-center text-[22px] leading-none flex-none">
              🚨
            </span>
          }
          label="SOS 긴급 도움 요청"
          description="위급 시에 버튼을 눌러주세요"
          onClick={onSosButtonClick}
          tone="danger"
          chevron={false}
        />
      </div>
    </div>
  </div>
);

export default HomePageLargeFont;
