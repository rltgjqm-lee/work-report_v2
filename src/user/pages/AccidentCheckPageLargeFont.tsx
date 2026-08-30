import { useState } from "react";

import { ChevronLeft } from "lucide-react";

import type { ActivityLogFormData } from "../../types/form";

import { sendSos } from "../api/sosApi";
import SosConfirmModal from "../components/molecule/SosConfirmModal";

interface AccidentCheckPageLargeFontProps {
  formData: ActivityLogFormData;
  setFormData: React.Dispatch<React.SetStateAction<ActivityLogFormData>>;
  onBack: () => void;
  onSaveButtonClick: () => void;
}

const choiceCardLargeClass = (selected: boolean) =>
  `flex items-center gap-5 border-[1.5px] rounded-2xl px-7 py-6 text-[23px] font-bold mb-4 cursor-pointer ${
    selected
      ? "border-brand bg-brand-tint text-brand"
      : "border-border-default bg-white text-text-strong"
  }`;

const choiceRadioLargeClass = (selected: boolean) =>
  `w-8 h-8 rounded-full border-2 flex-none flex items-center justify-center text-[17px] text-white ${
    selected ? "border-brand bg-brand" : "border-border-subtle bg-transparent"
  }`;

// 안전 일지 등록 화면 큰글씨 버전 — 보통글씨 버전(AccidentCheckPage.tsx + AppBar 등 공용
// 컴포넌트)과 배경·카드·버튼 색/모서리/그림자는 완전히 동일하고 글자·여백 크기만 키운
// 스킨이다. 저장 검증/확인 모달 등 로직은 AccidentCheckPage가 그대로 소유한다.
const AccidentCheckPageLargeFont = ({
  formData,
  setFormData,
  onBack,
  onSaveButtonClick,
}: AccidentCheckPageLargeFontProps) => {
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);

  const handleSosSend = () => {
    setIsSosModalOpen(false);
    if (!formData.participantId) return;
    sendSos(formData.participantId);
  };

  const handleAccidentToggleButtonClick = (hasAccident: boolean) => {
    setFormData((prev) => ({
      ...prev,
      hasAccident,
      accidentChecked: true,
      ...(!hasAccident && { accidentDetail: "", accidentAction: "업무수행" }),
    }));
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
          안전 일지 등록
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
          <img src="/icons/icon-safety.png" alt="" className="w-14 h-14 flex-none" />
          <div className="min-w-0">
            <div className="text-[21px] font-extrabold text-text-strong">안전 등록</div>
            <div className="text-[16px] text-text-muted font-semibold mt-1">
              오늘 안전사고 여부를 확인해주세요
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[20px] p-[20px] shadow-[0_1px_2px_rgba(20,30,50,0.04)]">
          <label className="text-[21px] font-extrabold text-text-strong mb-3.5 block">
            오늘 다치신 곳이 있으신가요?
          </label>
          <div
            className={choiceCardLargeClass(
              formData.accidentChecked && formData.hasAccident === false,
            )}
            onClick={() => handleAccidentToggleButtonClick(false)}
          >
            <span
              className={choiceRadioLargeClass(
                formData.accidentChecked && formData.hasAccident === false,
              )}
            >
              {formData.accidentChecked && formData.hasAccident === false ? "✓" : ""}
            </span>
            아니요, 없었습니다
          </div>
          <div
            className={choiceCardLargeClass(
              formData.accidentChecked && formData.hasAccident === true,
            )}
            onClick={() => handleAccidentToggleButtonClick(true)}
            style={{ marginBottom: 0 }}
          >
            <span
              className={choiceRadioLargeClass(
                formData.accidentChecked && formData.hasAccident === true,
              )}
            >
              {formData.accidentChecked && formData.hasAccident === true ? "✓" : ""}
            </span>
            예, 있었습니다
          </div>
        </div>

        {formData.hasAccident && (
          <div className="bg-white rounded-[20px] p-[20px] shadow-[0_1px_2px_rgba(20,30,50,0.04)] flex flex-col gap-7">
            <div>
              <label className="text-[21px] font-extrabold text-text-strong mb-3.5 block">
                사고내용 및 조치내용
              </label>
              <input
                type="text"
                value={formData.accidentDetail}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    accidentDetail: event.target.value,
                  }))
                }
                className="w-full h-[70px] box-border border-[1.5px] border-border-default rounded-2xl px-5 text-[24px] font-sans text-text-strong font-semibold bg-surface-muted"
                placeholder="예) 넘어짐, 응급조치 후 지속"
              />
            </div>

            <div>
              <label className="text-[21px] font-extrabold text-text-strong mb-3.5 block">
                안전사고 발생 후 업무 수행
              </label>
              <div
                className={choiceCardLargeClass(formData.accidentAction === "귀가")}
                onClick={() => setFormData((prev) => ({ ...prev, accidentAction: "귀가" }))}
              >
                <span className={choiceRadioLargeClass(formData.accidentAction === "귀가")}>
                  {formData.accidentAction === "귀가" ? "✓" : ""}
                </span>
                귀가
              </div>
              <div
                className={choiceCardLargeClass(formData.accidentAction === "업무수행")}
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    accidentAction: "업무수행",
                  }))
                }
              >
                <span className={choiceRadioLargeClass(formData.accidentAction === "업무수행")}>
                  {formData.accidentAction === "업무수행" ? "✓" : ""}
                </span>
                업무수행
              </div>
            </div>
          </div>
        )}
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
        <SosConfirmModal onSend={handleSosSend} onCancel={() => setIsSosModalOpen(false)} />
      )}
    </div>
  );
};

export default AccidentCheckPageLargeFont;
