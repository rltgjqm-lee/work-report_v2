import { useState } from "react";

import { ChevronLeft } from "lucide-react";

import type { ActivityLogFormData } from "../../types/form";

import { sendSos } from "../api/sosApi";
import SignatureCanvas from "../components/atoms/SignatureCanvas";
import SosConfirmModal from "../components/molecule/SosConfirmModal";

interface SignaturePageLargeFontProps {
  formData: ActivityLogFormData;
  setFormData: React.Dispatch<React.SetStateAction<ActivityLogFormData>>;
  onBack: () => void;
  onSaveAndFinishButtonClick: () => void;
}

const sigBoxLargeClass =
  "border-[1.5px] border-dashed border-border-dashed rounded-2xl h-[220px] bg-surface-muted relative flex items-center justify-center";
const sigClearLargeClass =
  "absolute top-4 right-4 bg-danger-tint text-danger text-[18px] font-bold px-5 py-2.5 rounded-[12px] border-none cursor-pointer";

// 서명 화면 큰글씨 버전 — 보통글씨 버전(SignaturePage.tsx + AppBar 등 공용 컴포넌트)과
// 배경·카드·버튼 색/모서리/그림자는 완전히 동일하고 글자·여백 크기만 키운 스킨이다.
// 서명 캔버스는 SignatureCanvas를 그대로 재사용해 그리기 로직을 중복하지 않고
// 박스/지우기 버튼 크기만 boxClassName/clearButtonClassName으로 키운다.
const SignaturePageLargeFont = ({
  formData,
  setFormData,
  onBack,
  onSaveAndFinishButtonClick,
}: SignaturePageLargeFontProps) => {
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
          서명
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
        <div className="bg-white rounded-[20px] p-6 shadow-[0_1px_2px_rgba(20,30,50,0.04)] flex items-center gap-5">
          <img src="/icons/icon-signature.png" alt="" className="w-14 h-14 flex-none" />
          <div>
            <div className="text-[21px] font-extrabold text-text-strong">참여자 서명</div>
            <div className="text-[17px] text-text-muted font-semibold mt-1">
              서명을 남기고 활동일지를 완료해주세요
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[20px] p-7 shadow-[0_1px_2px_rgba(20,30,50,0.04)] flex flex-col gap-5">
          <label className="text-[21px] font-extrabold text-text-strong block">
            여기에 서명해 주세요 (필수)
            <small className="block text-[17px] text-text-muted font-semibold mt-1.5">
              매일 새로 서명해야 해요
            </small>
          </label>
          <SignatureCanvas
            value={formData.userSignature}
            onChange={(dataUrl) => setFormData((prev) => ({ ...prev, userSignature: dataUrl }))}
            boxClassName={sigBoxLargeClass}
            clearButtonClassName={sigClearLargeClass}
          />
        </div>

        <div className="bg-white rounded-[20px] p-7 shadow-[0_1px_2px_rgba(20,30,50,0.04)] flex flex-col gap-5">
          <label className="text-[21px] font-extrabold text-text-strong block">
            확인자 서명
            <small className="block text-[17px] text-text-muted font-semibold mt-1.5">
              선택 사항이에요
            </small>
          </label>
          <SignatureCanvas
            value={formData.demandSignature}
            onChange={(dataUrl) => setFormData((prev) => ({ ...prev, demandSignature: dataUrl }))}
            boxClassName={sigBoxLargeClass}
            clearButtonClassName={sigClearLargeClass}
          />
        </div>
      </div>

      <div className="flex-none bg-white px-7 pt-5 pb-6 flex flex-col gap-3.5 border-t border-surface-page">
        <button
          onClick={onSaveAndFinishButtonClick}
          className="w-full h-[74px] bg-brand text-white border-none rounded-2xl text-[23px] font-extrabold font-sans cursor-pointer"
        >
          저장하고 마치기
        </button>
      </div>

      {isSosModalOpen && (
        <SosConfirmModal onSend={handleSosSend} onCancel={() => setIsSosModalOpen(false)} />
      )}
    </div>
  );
};

export default SignaturePageLargeFont;
