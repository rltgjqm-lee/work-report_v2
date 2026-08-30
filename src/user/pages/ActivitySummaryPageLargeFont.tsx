import { useState } from "react";

import { ChevronLeft } from "lucide-react";

import type { ActivityLogFormData } from "../../types/form";
import { formatTimeField, getLocalToday } from "../../utils/timeFormat";

import { sendSos } from "../api/sosApi";
import SosConfirmModal from "../components/molecule/SosConfirmModal";

interface ActivitySummaryPageLargeFontProps {
  formData: ActivityLogFormData;
  onBack: () => void;
  onNext: () => void;
}

const SummaryRowLarge = ({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) => (
  <div className="flex items-center justify-between gap-4 py-[17px] border-b border-surface-page last:border-b-0 text-[20px]">
    <div className="flex items-center gap-4 min-w-0">
      <img src={icon} alt="" className="w-11 h-11 flex-none" />
      <span className="text-text-muted font-bold flex-none">{label}</span>
    </div>
    <span className="text-text-strong font-extrabold text-right">{value}</span>
  </div>
);

// 오늘의 활동 요약 화면 큰글씨 버전 — 보통글씨 버전(ActivitySummaryPage.tsx + AppBar 등
// 공용 컴포넌트)과 배경·카드·버튼 색/모서리/그림자는 완전히 동일하고 글자·아이콘·여백
// 크기만 키운 스킨이다. 요약 값은 formData에서 그대로 파생되므로 별도 로직 없이 이
// 컴포넌트가 직접 계산한다(다른 화면의 mutation/모달 상태 같은 로직이 없다).
const ActivitySummaryPageLargeFont = ({
  formData,
  onBack,
  onNext,
}: ActivitySummaryPageLargeFontProps) => {
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);
  const isCompetencyProgram = formData.programType === "역량 활용";
  const todayLabel = getLocalToday().replaceAll("-", ".");

  const handleSosSend = () => {
    setIsSosModalOpen(false);
    if (!formData.participantId) return;
    sendSos(formData.participantId);
  };

  return (
    <div className="flex flex-col bg-surface-page h-full min-h-0 flex-1 overflow-y-auto">
      <div className="flex-none sticky top-0 z-10 flex items-center gap-2 px-[16px] py-[10px] bg-white border-b border-surface-page">
        <button
          onClick={onBack}
          className="w-[44px] h-[44px] rounded-xl bg-surface-page border-none flex items-center justify-center flex-none cursor-pointer"
          aria-label="이전으로"
        >
          <ChevronLeft size={22} color="#333d4b" strokeWidth={2.2} />
        </button>
        <span className="flex-1 text-center text-[20px] font-extrabold text-text-strong">
          활동 요약
        </span>
        {formData.participantId ? (
          <button
            onClick={() => setIsSosModalOpen(true)}
            className="w-[44px] h-[44px] rounded-xl bg-danger-tint border-none flex items-center justify-center flex-none cursor-pointer"
            aria-label="SOS 긴급 도움 요청"
          >
            <span className="text-[20px] leading-none">🚨</span>
          </button>
        ) : (
          <span className="w-[44px] flex-none" />
        )}
      </div>

      <div className="px-[16px] py-[20px] flex-1 flex flex-col gap-5">
        <div className="bg-white rounded-[18px] px-[20px] py-[16px] shadow-[0_2px_8px_rgba(20,30,50,0.05)]">
          <div className="text-[17px] text-text-muted font-bold mb-5">
            {todayLabel} · {formData.userName}님, 안녕하세요
          </div>
          <div className="text-[20px] font-extrabold text-text-strong">오늘 활동을 마쳤어요</div>
          <div className="text-[19px] text-text-tertiary font-semibold mt-2">
            아래 내용을 확인하고 서명해주세요.
          </div>
        </div>

        <div className="bg-white rounded-[20px] px-[20px] py-[16px] shadow-[0_1px_2px_rgba(20,30,50,0.04)] flex flex-col gap-2">
          <SummaryRowLarge
            icon="/icons/icon-checkin-clock.png"
            label="출근 시각"
            value={
              formData.startTime.hour
                ? `${formatTimeField(formData.startTime)} 완료`
                : "아직이에요"
            }
          />
          {!isCompetencyProgram && (
            <>
              <SummaryRowLarge
                icon="/icons/icon-task.png"
                label="활동 내역"
                value={formData.actContent || "미등록"}
              />
              <SummaryRowLarge
                icon="/icons/icon-map.png"
                label="활동 장소"
                value={formData.actPlace || "미등록"}
              />
              <SummaryRowLarge
                icon="/icons/icon-safety.png"
                label="사고 유무"
                value={
                  !formData.accidentChecked
                    ? "미확인"
                    : formData.hasAccident
                      ? "있었습니다"
                      : "없었습니다"
                }
              />
            </>
          )}
          <SummaryRowLarge
            icon="/icons/icon-checkout-clock.png"
            label="퇴근 시각"
            value={
              formData.endTime.hour ? `${formatTimeField(formData.endTime)} 완료` : "아직이에요"
            }
          />
        </div>
      </div>

      <div className="flex-none bg-white px-7 pt-5 pb-6 flex flex-col gap-3.5 border-t border-surface-page">
        <div className="flex gap-3.5">
          <button
            onClick={onBack}
            className="flex-1 h-[70px] bg-white text-brand border-[1.5px] border-brand rounded-2xl text-[21px] font-extrabold font-sans cursor-pointer"
          >
            이전
          </button>
          <button
            onClick={onNext}
            className="flex-1 h-[74px] bg-brand text-white border-none rounded-2xl text-[23px] font-extrabold font-sans cursor-pointer"
          >
            서명하기
          </button>
        </div>
      </div>

      {isSosModalOpen && (
        <SosConfirmModal onSend={handleSosSend} onCancel={() => setIsSosModalOpen(false)} />
      )}
    </div>
  );
};

export default ActivitySummaryPageLargeFont;
