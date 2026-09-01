import { useState } from "react";

import { ChevronLeft } from "lucide-react";

import type { ActivityLogFormData } from "../../types/form";

import { sendSos } from "../api/sosApi";
import SosConfirmModalLargeFont from "../components/molecule/SosConfirmModalLargeFont";

interface ActivityReportPageLargeFontProps {
  formData: ActivityLogFormData;
  setFormData: React.Dispatch<React.SetStateAction<ActivityLogFormData>>;
  onBack: () => void;
  onSaveButtonClick: () => void;
}

// 업무 일지 등록 화면 큰글씨 버전 — 보통글씨 버전(ActivityReportPage.tsx + AppBar 등 공용
// 컴포넌트)과 배경·카드·버튼 색/모서리/그림자는 완전히 동일하고 글자·여백 크기만 키운
// 스킨이다. 저장 검증/확인 모달 등 로직은 ActivityReportPage가 그대로 소유한다.
const ActivityReportPageLargeFont = ({
  formData,
  setFormData,
  onBack,
  onSaveButtonClick,
}: ActivityReportPageLargeFontProps) => {
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);

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
        업무 일지 등록
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
      <div className="bg-white rounded-[20px] p-[20px] shadow-[0_1px_2px_rgba(20,30,50,0.04)] flex items-center gap-3">
        <img src="/icons/icon-task.png" alt="" className="w-14 h-14 flex-none" />
        <div className="min-w-0">
          <div className="text-[21px] font-extrabold text-text-strong">업무 등록</div>
          <div className="text-[16px] text-text-muted font-semibold mt-1">
            오늘 하신 업무 내용을 남겨주세요
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[20px] p-[20px] shadow-[0_1px_2px_rgba(20,30,50,0.04)] flex flex-col gap-7">
        <div>
          <label className="text-[21px] font-extrabold text-text-strong mb-3.5 block">
            오늘 무엇을 하셨나요?
            <small className="block text-[17px] text-text-muted font-semibold mt-1.5">
              활동내용
            </small>
          </label>
          <textarea
            value={formData.actContent}
            onChange={(event) =>
              setFormData((prev) => ({
                ...prev,
                actContent: event.target.value,
              }))
            }
            className="w-full box-border border-[1.5px] border-border-default rounded-2xl p-5 text-[23px] font-sans text-text-strong font-semibold bg-surface-muted h-32 resize-none leading-relaxed"
            placeholder="오늘 수행하신 활동 내용을 적어주세요."
          />
        </div>

        <div>
          <label className="text-[21px] font-extrabold text-text-strong mb-3.5 block">
            어디에서 하셨나요?
            <small className="block text-[17px] text-text-muted font-semibold mt-1.5">
              활동장소
            </small>
          </label>
          <textarea
            value={formData.actPlace}
            onChange={(event) =>
              setFormData((prev) => ({
                ...prev,
                actPlace: event.target.value,
              }))
            }
            className="w-full box-border border-[1.5px] border-border-default rounded-2xl p-5 text-[23px] font-sans text-text-strong font-semibold bg-surface-muted h-32 resize-none leading-relaxed"
            placeholder="활동하신 장소를 적어주세요."
          />
        </div>
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
          onClick={onSaveButtonClick}
          className="flex-1 h-[74px] bg-brand text-white border-none rounded-2xl text-[23px] font-extrabold font-sans cursor-pointer"
        >
          저장
        </button>
      </div>
    </div>

    {isSosModalOpen && (
      <SosConfirmModalLargeFont onSend={handleSosSend} onCancel={() => setIsSosModalOpen(false)} />
    )}
  </div>
  );
};

export default ActivityReportPageLargeFont;
