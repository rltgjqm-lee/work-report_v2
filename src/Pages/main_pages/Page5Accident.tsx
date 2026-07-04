import React from "react";
import Button from "../../components/atoms/Button";
import type { ActivityLogFormData } from "../../types/form";

interface Page5Props {
  formData: ActivityLogFormData;
  setFormData: React.Dispatch<React.SetStateAction<ActivityLogFormData>>;
  onSave: () => void; // 💡 IndexedDB 임시저장 브릿지
  onNext: () => void; // 💡 Page 6(서명 페이지) 이동 브릿지
  onAlert: (messages: string[]) => void;
}

const Page5Accident = ({
  formData,
  setFormData,
  onSave,
  onNext,
  onAlert,
}: Page5Props) => {
  const handleToggleAccident = (hasAccident: boolean) => {
    setFormData((prev) => ({
      ...prev,
      hasAccident,
      // '무'를 선택하면 기존에 입력했던 상세 정보들을 깔끔하게 초기화해줍니다.
      ...(!hasAccident && { accidentDetail: "", accidentAction: "업무수행" }),
    }));
  };

  const handleNextStep = () => {
    if (formData.hasAccident && !formData.accidentDetail.trim()) {
      onAlert(["사고내용 및 조치내용을 입력해주세요."]);
      return;
    }
    onNext();
  };

  return (
    <div
      className="p-[30px_20px] flex flex-1 flex-col max-[600px]:p-[20px_15px]"
      id="page5"
    >
      <div className="text-[22px] font-bold mb-[25px] text-[#2c3e50] text-left tracking-[-0.5px] max-[600px]:text-[20px] max-[600px]:mb-[18px]">
        안전사고 유무 확인
      </div>

      {/* 안전사고 발생유무 라디오 영역 */}
      <div className="flex flex-col items-start mb-[25px] gap-2.5 max-[600px]:mb-[18px] max-[600px]:gap-[6px] w-full">
        <div className="text-[16px] font-bold w-full text-[#34495e] flex-none max-[600px]:text-[15px] max-[600px]:mb-[2px]">
          안전사고 발생유무
        </div>
        <div className="flex gap-[30px] mt-2.5 w-full flex-none max-[600px]:gap-5">
          <label className="text-[14px] flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="accident"
              className="w-5 h-5"
              checked={formData.hasAccident === true}
              onChange={() => handleToggleAccident(true)}
            />{" "}
            유
          </label>
          <label className="text-[14px] flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="accident"
              className="w-5 h-5"
              checked={formData.hasAccident === false}
              onChange={() => handleToggleAccident(false)}
            />{" "}
            무
          </label>
        </div>
      </div>

      {formData.hasAccident && (
        <>
          {/* 사고내용 및 조치내용 */}
          <div className="flex flex-col items-start mb-[25px] gap-2.5 max-[600px]:mb-[18px] max-[600px]:gap-[6px] w-full animate-fadeIn">
            <div className="text-[16px] font-bold w-full text-[#34495e] flex-none max-[600px]:text-[15px] max-[600px]:mb-[2px]">
              사고내용 및 조치내용
            </div>
            <input
              type="text"
              id="accidentDetail"
              value={formData.accidentDetail}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  accidentDetail: e.target.value,
                }))
              }
              className="w-full p-[14px] text-[16px] font-sans border-[2.5px] border-[#2c3e50] rounded-xl outline-none box-border max-[600px]:p-[10px] max-[600px]:text-[14px] max-[600px]:border-[1.5px]"
              placeholder="예) 넘어짐, 응급조치 후 지속"
            />
          </div>

          {/* 안전사고 발생 후 업무 수행 라디오 */}
          <div className="flex flex-col items-start mb-[25px] gap-2.5 max-[600px]:mb-[18px] max-[600px]:gap-[6px] w-full animate-fadeIn">
            <div className="text-[16px] font-bold w-full text-[#34495e] flex-none max-[600px]:text-[15px] max-[600px]:mb-[2px]">
              안전사고 발생 후 업무 수행
            </div>
            <div className="flex gap-[30px] mt-2.5 w-full flex-none max-[600px]:gap-5">
              <label className="text-[14px] flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="accidentAction"
                  className="w-5 h-5"
                  checked={formData.accidentAction === "귀가"}
                  onChange={() =>
                    setFormData((prev) => ({ ...prev, accidentAction: "귀가" }))
                  }
                />{" "}
                귀가
              </label>
              <label className="text-[14px] flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="accidentAction"
                  className="w-5 h-5"
                  checked={formData.accidentAction === "업무수행"}
                  onChange={() =>
                    setFormData((prev) => ({
                      ...prev,
                      accidentAction: "업무수행",
                    }))
                  }
                />{" "}
                업무수행
              </label>
            </div>
          </div>
        </>
      )}

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

export default Page5Accident;
