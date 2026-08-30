import { useState, type ReactNode } from "react";

import { Building2, Settings } from "lucide-react";

import type { ActivityLogFormData } from "../../types/form";

import { sendSos } from "../api/sosApi";
import SosConfirmModal from "../components/molecule/SosConfirmModal";
import SosIdentificationRequiredModal from "../components/molecule/SosIdentificationRequiredModal";
import SosUnavailableModal from "../components/molecule/SosUnavailableModal";
import { computeTodayWorkCardStatus, type TodayStatus } from "../utils/todayWorkStatus";
import HomePageLargeFont from "./HomePageLargeFont";

interface HomePageProps {
  formData: ActivityLogFormData;
  todayStatus: TodayStatus | null;
  onOpenAffiliation: () => void;
  onStartActivityLog: () => void;
  onOpenSettings: () => void;
  onToggleLargeFontMode: () => void;
  isLargeFontMode: boolean;
}

interface HomeActionCardProps {
  onClick: () => void;
  iconSrc: string;
  title: string;
  description: ReactNode;
}

interface TodayWorkCardProps {
  formData: ActivityLogFormData;
  todayStatus: TodayStatus | null;
}

/**
 * 앱 메인 페이지
 */
const HomePage = ({
  formData,
  todayStatus,
  onOpenAffiliation,
  onStartActivityLog,
  onOpenSettings,
  onToggleLargeFontMode,
  isLargeFontMode,
}: HomePageProps) => {
  const [isSosConfirmModalOpen, setIsSosConfirmModalOpen] = useState(false);
  const [isSosIdentificationModalOpen, setIsSosIdentificationModalOpen] = useState(false);
  const [isSosUnavailableModalOpen, setIsSosUnavailableModalOpen] = useState(false);

  // participantId는 있지만 서버 응답 전(로딩 중)엔 근무일로 가정한다(TodayWorkCard와 동일 기준).
  const isWorkDay = todayStatus?.isWorkDay ?? true;
  const attendanceOutDone = formData.endTime.hour !== "";
  // 근무 중(근무일 + 아직 퇴근 전)일 때만 SOS를 쓸 수 있다 — 휴무일이거나 이미
  // 퇴근했으면 더 이상 근무 중이 아니므로 막는다.
  const isSosAvailable = isWorkDay && !attendanceOutDone;

  // 본인확인 전(participantId 없음)엔 누구의 SOS인지 알 수 없으니 확인 카운트다운 대신
  // 안내 모달로 보낸다. 확인이 끝난 뒤엔 한 번만 눌러도 바로 SOS 확인 모달이 뜬다 —
  // 오탐 방지는 탭 횟수가 아니라 그 모달의 10초 취소 카운트다운이 맡는다. 버튼 자체는
  // 항상 활성화된 것처럼 보이고, 근무 중이 아닐 때 눌리면 안내 모달로 이유를 알려준다.
  const handleSosButtonClick = () => {
    if (!isSosAvailable) {
      setIsSosUnavailableModalOpen(true);
      return;
    }
    if (!formData.participantId) {
      setIsSosIdentificationModalOpen(true);
      return;
    }
    setIsSosConfirmModalOpen(true);
  };

  const handleSosSend = () => {
    setIsSosConfirmModalOpen(false);
    if (!formData.participantId) return;
    sendSos(formData.participantId);
  };

  const handleSosCancel = () => {
    setIsSosConfirmModalOpen(false);
  };

  if (isLargeFontMode) {
    return (
      <>
        <HomePageLargeFont
          formData={formData}
          todayStatus={todayStatus}
          onOpenAffiliation={onOpenAffiliation}
          onStartActivityLog={onStartActivityLog}
          onOpenSettings={onOpenSettings}
          onToggleLargeFontMode={onToggleLargeFontMode}
          onSosButtonClick={handleSosButtonClick}
        />

        {isSosConfirmModalOpen && (
          <SosConfirmModal onSend={handleSosSend} onCancel={handleSosCancel} />
        )}
        {isSosIdentificationModalOpen && (
          <SosIdentificationRequiredModal
            onConfirm={() => setIsSosIdentificationModalOpen(false)}
          />
        )}
        {isSosUnavailableModalOpen && (
          <SosUnavailableModal onConfirm={() => setIsSosUnavailableModalOpen(false)} />
        )}
      </>
    );
  }

  return (
    <>
        <div
          className="flex flex-col h-full min-h-0 flex-1 overflow-y-auto"
          style={{ background: "linear-gradient(180deg,#eaf2ff 0%,#f2f4f6 min(320px,60vh))" }}
        >
          <div className="h-[60px] flex items-center justify-between gap-2 px-[clamp(16px,5vw,24px)]">
            <div className="flex items-center justify-between w-full">
              <div className="flex gap-1.5">
                <img src="/icons/app-icon-64.png" alt="" className="w-5 h-5 rounded-[6px]" />
                <p className="text-[clamp(12px,3vw,13px)] font-extrabold tracking-[1.2px] text-text-tertiary">
                  WORK SAFE
                </p>
              </div>

              <div className="flex items-center gap-3.5">
                <button
                  onClick={onToggleLargeFontMode}
                  className="h-7 px-2.5 rounded-[12px] border border-border-default bg-white text-[11px] font-bold text-text-tertiary cursor-pointer"
                  aria-label="큰글씨로 보기"
                >
                  큰글씨로
                </button>
                <button onClick={onOpenSettings} className="cursor-pointer" aria-label="설정">
                  <Settings size={16} color="#333d4b" strokeWidth={2.2} />
                </button>
              </div>
            </div>
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

            <TodayWorkCard formData={formData} todayStatus={todayStatus} />

            <div className="flex gap-[clamp(10px,3.5vw,14px)]">
              <HomeActionCard
                onClick={onOpenAffiliation}
                iconSrc="/icons/icon-basic-info.png"
                title="기본정보 등록"
                description={
                  <>
                    처음 한 번만,
                    <br />내 정보를 등록해요
                  </>
                }
              />
              <HomeActionCard
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
              />
            </div>

            <SosButton onClick={handleSosButtonClick} />

            <div className="flex-1 min-h-[24px]" />
          </div>
        </div>

      {isSosConfirmModalOpen && (
        <SosConfirmModal onSend={handleSosSend} onCancel={handleSosCancel} />
      )}
      {isSosIdentificationModalOpen && (
        <SosIdentificationRequiredModal onConfirm={() => setIsSosIdentificationModalOpen(false)} />
      )}
      {isSosUnavailableModalOpen && (
        <SosUnavailableModal onConfirm={() => setIsSosUnavailableModalOpen(false)} />
      )}
    </>
  );
};

const StatusPill = ({ label, active }: { label: string; active: boolean }) => (
  <div
    className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full flex-none ${
      active ? "bg-brand-tint text-brand" : "bg-surface-page text-[#6b7684]"
    }`}
  >
    <span className={`w-[5px] h-[5px] rounded-full ${active ? "bg-brand" : "bg-[#c7ccd4]"}`} />
    <p className="flex items-center text-center h-3.5 leading-[14px] mb-[1px]">{label}</p>
  </div>
);

const cardClass =
  "bg-white rounded-[18px] px-[clamp(16px,5vw,20px)] py-[clamp(15px,4.5vw,18px)] mb-[clamp(18px,5.5vw,24px)] shadow-[0_2px_8px_rgba(20,30,50,.05)]";

const TodayWorkCard = ({ formData, todayStatus }: TodayWorkCardProps) => {
  const status = computeTodayWorkCardStatus(formData, todayStatus);

  if (status.kind === "noUserName") {
    return null;
  }

  if (status.kind === "noParticipantId") {
    return (
      <div className={cardClass}>
        <div className="text-[12.5px] font-bold text-text-muted mb-1">오늘의 근무</div>
        <div className="text-[14px] text-text-tertiary font-semibold leading-[1.6]">
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
    <div className={cardClass}>
      <div className="flex flex-col gap-[clamp(12px,3.5vw,14px)] text-left">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex flex-col gap-1">
            <span className="text-[12.5px] font-bold text-text-muted">오늘의 근무</span>
            <span className="text-[clamp(15px,4vw,16px)] font-extrabold text-text-strong">
              {dateLabel}
            </span>
          </div>
          <StatusPill label={statusLabel} active={isWorkDay && isWorking} />
        </div>

        {programName && <div className="border-t border-surface-page" />}

        {programName && (
          <div className="flex items-center gap-2">
            <div className="w-[clamp(22px,6vw,24px)] h-[clamp(22px,6vw,24px)] rounded-[8px] bg-brand-tint flex items-center justify-center flex-none">
              <Building2 className="w-[55%] h-[55%] text-brand" strokeWidth={2.2} />
            </div>
            <span className="text-[clamp(14px,3.8vw,14.5px)] font-bold text-text-strong">
              {programName}
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
                {shiftLabel}
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

// 본인확인 여부와 무관하게 항상 눌리는 버튼이다 — 본인확인 전이면 클릭 시
// SosIdentificationRequiredModal로 안내하고, 근무 중이 아니면 SosUnavailableModal로
// 안내한다. 둘 다 아니면 SosConfirmModal로 이어진다(HomePage에서 분기).
const SosButton = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="mt-3.5 w-full rounded-[12px] px-4 py-3.5 flex flex-col items-center justify-center bg-white cursor-pointer shadow-[0_2px_8px_rgba(20,30,50,.05)]"
  >
    <div className="flex items-center gap-2">
      <span className="text-[20px] leading-none">🚨</span>
      <span className="text-base font-extrabold tracking-[0.02em] text-text-tertiary">
        SOS 긴급 도움 요청
      </span>
    </div>
    <span className="text-[12px] font-semibold text-text-muted">위급 시에 버튼을 눌러주세요</span>
  </button>
);

export default HomePage;
