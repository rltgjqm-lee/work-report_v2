import type { ActivityLogFormData } from "../../types/form";

import Button from "../../components/atoms/Button";

interface Page4Props {
  formData: ActivityLogFormData;
  setFormData: React.Dispatch<React.SetStateAction<ActivityLogFormData>>;
  onSave: () => void; // 💡 IndexedDB 임시저장 브릿지
  onNext: () => void; // 💡 Page 5(안전사고 페이지) 이동 브릿지
  onAlert: (messages: string[]) => void;
}

/**
 * Page 4: 활동 내용 및 장소
 */
const Page4ContentPlace = ({
  formData,
  setFormData,
  onSave,
  onNext,
  onAlert,
}: Page4Props) => {
  // 💡 다음 단계 이동 전 유효성 검증 핸들러
  const handleNextStep = () => {
    if (!formData.actContent.trim()) {
      onAlert(["활동 내용을 입력해주세요."]);
      return;
    }
    if (!formData.actPlace.trim()) {
      onAlert(["활동 장소를 입력해주세요."]);
      return;
    }
    onNext();
  };

  return (
    <div
      className="p-[30px_20px] flex flex-1 flex-col max-[600px]:p-[20px_15px]"
      id="page4"
    >
      <div className="text-[22px] font-bold mb-[25px] text-[#2c3e50] text-left tracking-[-0.5px] max-[600px]:text-[20px] max-[600px]:mb-[18px]">
        활동 내용 및 장소
      </div>

      {/* 활동 내용 텍스트 영역 */}
      <div className="flex flex-col items-start mb-[25px] gap-2.5 max-[600px]:mb-[18px] max-[600px]:gap-[6px] w-full">
        <div className="text-[16px] font-bold w-full text-[#34495e] flex-none max-[600px]:text-[15px] max-[600px]:mb-[2px]">
          활동내용
        </div>
        <textarea
          id="actContent"
          value={formData.actContent}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, actContent: e.target.value }))
          }
          className="w-full p-[14px] text-[16px] font-sans border-[2.5px] border-[#2c3e50] rounded-xl outline-none box-border max-[600px]:p-[10px] max-[600px]:text-[14px] max-[600px]:border-[1.5px] resize-none"
          rows={2}
          placeholder="오늘 수행하신 활동 내용을 적어주세요."
        />
      </div>

      {/* 활동 장소 텍스트 영역 */}
      <div className="flex flex-col items-start mb-[25px] gap-2.5 max-[600px]:mb-[18px] max-[600px]:gap-[6px] w-full">
        <div className="text-[16px] font-bold w-full text-[#34495e] flex-none max-[600px]:text-[15px] max-[600px]:mb-[2px]">
          활동장소
        </div>
        <textarea
          id="actPlace"
          value={formData.actPlace}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, actPlace: e.target.value }))
          }
          className="w-full p-[14px] text-[16px] font-sans border-[2.5px] border-[#2c3e50] rounded-xl outline-none box-border max-[600px]:p-[10px] max-[600px]:text-[14px] max-[600px]:border-[1.5px] resize-none"
          rows={2}
          placeholder="활동하신 장소를 적어주세요."
        />
      </div>

      {/* 하단 액션 버튼 */}
      <div className="flex justify-center gap-2 mt-auto pt-5 max-[600px]:mt-5 max-[600px]:pt-0">
        <Button variant="blue" onClick={onSave}>
          저장하기
        </Button>
        <Button variant="white" onClick={handleNextStep}>
          다음
        </Button>
      </div>
    </div>
  );
};

export default Page4ContentPlace;
