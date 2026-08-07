import { useState } from "react";

import type { ActivityLogFormData } from "../../types/form";
import AppBar from "../../components/molecule/AppBar";
import SafetySaveConfirmModal from "../../components/molecule/SafetySaveConfirmModal";
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
  onBack: () => void; // 💡 홈으로 돌아가기(취소)
  onSave: () => Promise<void>; // 💡 IndexedDB 임시저장 브릿지
  onNext: () => void; // 💡 저장 후 홈으로 돌아가기
  onAlert: (messages: string[]) => Promise<void>;
}

/**
 * 안전 등록 모듈 — 홈 대시보드에서 진입, 저장하면 다시 홈으로 돌아간다.
 */
const AccidentCheckPage = ({
  formData,
  setFormData,
  onBack,
  onSave,
  onNext,
  onAlert,
}: Page5Props) => {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleAccidentToggleButtonClick = (hasAccident: boolean) => {
    setFormData((prev) => ({
      ...prev,
      hasAccident,
      accidentChecked: true,
      // '무'를 선택하면 기존에 입력했던 상세 정보들을 깔끔하게 초기화해줍니다.
      ...(!hasAccident && { accidentDetail: "", accidentAction: "업무수행" }),
    }));
  };

  const handleSaveButtonClick = () => {
    if (!formData.accidentChecked) {
      onAlert(["사고 유무를 선택해주세요."]);
      return;
    }
    if (formData.hasAccident && !formData.accidentDetail.trim()) {
      onAlert(["사고내용 및 조치내용을 입력해주세요."]);
      return;
    }
    setConfirmOpen(true);
  };

  const handleSaveConfirmButtonClick = async () => {
    setConfirmOpen(false);
    await onSave();
    onNext();
  };

  return (
    <div className={pageClass}>
      <AppBar title="안전 일지 등록" onBack={onBack} />
      <div className={bodyClass}>
        <label className={labelClass + " px-1"}>오늘 다치신 곳이 있으신가요?</label>
        <div
          className={choiceCardClass(formData.accidentChecked && formData.hasAccident === true)}
          onClick={() => handleAccidentToggleButtonClick(true)}
        >
          <span
            className={choiceRadioClass(formData.accidentChecked && formData.hasAccident === true)}
          >
            {formData.accidentChecked && formData.hasAccident === true ? "✓" : ""}
          </span>
          예, 있었습니다
        </div>
        <div
          className={choiceCardClass(formData.accidentChecked && formData.hasAccident === false)}
          onClick={() => handleAccidentToggleButtonClick(false)}
        >
          <span
            className={choiceRadioClass(formData.accidentChecked && formData.hasAccident === false)}
          >
            {formData.accidentChecked && formData.hasAccident === false ? "✓" : ""}
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
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    accidentDetail: event.target.value,
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
                onClick={() => setFormData((prev) => ({ ...prev, accidentAction: "귀가" }))}
              >
                <span className={choiceRadioClass(formData.accidentAction === "귀가")}>
                  {formData.accidentAction === "귀가" ? "✓" : ""}
                </span>
                귀가
              </div>
              <div
                className={choiceCardClass(formData.accidentAction === "업무수행")}
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    accidentAction: "업무수행",
                  }))
                }
              >
                <span className={choiceRadioClass(formData.accidentAction === "업무수행")}>
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
          <button className={btnOutlineClass} onClick={onBack}>
            이전
          </button>
          <button className={btnPrimaryClass + " flex-1"} onClick={handleSaveButtonClick}>
            저장
          </button>
        </BottomBarRow>
      </BottomBar>

      {confirmOpen && (
        <SafetySaveConfirmModal
          hasAccident={formData.hasAccident}
          accidentDetail={formData.accidentDetail}
          accidentAction={formData.accidentAction}
          onConfirm={handleSaveConfirmButtonClick}
        />
      )}
    </div>
  );
};

export default AccidentCheckPage;
