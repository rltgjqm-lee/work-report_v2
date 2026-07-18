import type { ActivityLogFormData } from "../../types/form";
import AppBar from "../../components/molecule/AppBar";
import ProgressBar from "../../components/atoms/ProgressBar";
import Card from "../../components/atoms/Card";
import BottomBar, { BottomBarRow } from "../../components/atoms/BottomBar";
import {
  pageClass,
  bodyClass,
  labelClass,
  inputClass,
  btnPrimaryClass,
  btnOutlineClass,
  choiceCardClass,
  choiceRadioClass,
} from "../../components/atoms/classes";

interface Page5Props {
  formData: ActivityLogFormData;
  setFormData: React.Dispatch<React.SetStateAction<ActivityLogFormData>>;
  onBack: () => void;
  onSave: () => void; // 💡 IndexedDB 임시저장 브릿지
  onNext: () => void; // 💡 Page 6(서명 페이지) 이동 브릿지
  onAlert: (messages: string[]) => void;
}

const AccidentCheckPage = ({
  formData,
  setFormData,
  onBack,
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
    <div className={pageClass}>
      <AppBar title="안전 확인" onBack={onBack} />
      <ProgressBar step={4} />
      <div className={bodyClass}>
        <label className={labelClass + " px-1"}>
          오늘 다치신 곳이 있으신가요?
        </label>
        <div
          className={choiceCardClass(formData.hasAccident === true)}
          onClick={() => handleToggleAccident(true)}
        >
          <span className={choiceRadioClass(formData.hasAccident === true)}>
            {formData.hasAccident === true ? "✓" : ""}
          </span>
          예, 있었습니다
        </div>
        <div
          className={choiceCardClass(formData.hasAccident === false)}
          onClick={() => handleToggleAccident(false)}
        >
          <span className={choiceRadioClass(formData.hasAccident === false)}>
            {formData.hasAccident === false ? "✓" : ""}
          </span>
          아니요, 없었습니다
        </div>

        {formData.hasAccident && (
          <Card>
            <div>
              <label className={labelClass}>사고내용 및 조치내용</label>
              <input
                type="text"
                value={formData.accidentDetail}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    accidentDetail: e.target.value,
                  }))
                }
                className={inputClass}
                placeholder="예) 넘어짐, 응급조치 후 지속"
              />
            </div>

            <div>
              <label className={labelClass}>안전사고 발생 후 업무 수행</label>
              <div
                className={choiceCardClass(formData.accidentAction === "귀가")}
                onClick={() =>
                  setFormData((prev) => ({ ...prev, accidentAction: "귀가" }))
                }
              >
                <span
                  className={choiceRadioClass(
                    formData.accidentAction === "귀가",
                  )}
                >
                  {formData.accidentAction === "귀가" ? "✓" : ""}
                </span>
                귀가
              </div>
              <div
                className={choiceCardClass(
                  formData.accidentAction === "업무수행",
                )}
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    accidentAction: "업무수행",
                  }))
                }
              >
                <span
                  className={choiceRadioClass(
                    formData.accidentAction === "업무수행",
                  )}
                >
                  {formData.accidentAction === "업무수행" ? "✓" : ""}
                </span>
                업무수행
              </div>
            </div>
          </Card>
        )}
      </div>

      <BottomBar>
        <BottomBarRow>
          <button className={btnOutlineClass} onClick={onSave}>
            저장하기
          </button>
          <button
            className={btnPrimaryClass + " flex-1"}
            onClick={handleNextStep}
          >
            다음
          </button>
        </BottomBarRow>
      </BottomBar>
    </div>
  );
};

export default AccidentCheckPage;
