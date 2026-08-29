import { useState } from "react";

import type { ActivityLogFormData } from "../../types/form";

import {
  bodyClass,
  btnOutlineClass,
  btnPrimaryClass,
  choiceCardClass,
  choiceRadioClass,
  inputClass,
  labelClass,
  pageClass,
} from "../../components/atoms/classes";

import BottomBar, { BottomBarRow } from "../components/atoms/BottomBar";
import Card from "../components/atoms/Card";
import AppBar from "../components/molecule/AppBar";
import PageHeaderCard from "../components/molecule/PageHeaderCard";
import SafetySaveConfirmModal from "../components/molecule/SafetySaveConfirmModal";
import AccidentCheckPageLargeFont from "./AccidentCheckPageLargeFont";

interface Page5Props {
  formData: ActivityLogFormData;
  setFormData: React.Dispatch<React.SetStateAction<ActivityLogFormData>>;
  onBack: () => void;
  onSave: () => Promise<void>;
  onNext: () => void;
  onAlert: (messages: string[]) => Promise<void>;
  isLargeFontMode: boolean;
}

/**
 * 안전 등록 페이지입니다.
 */
const AccidentCheckPage = ({
  formData,
  setFormData,
  onBack,
  onSave,
  onNext,
  onAlert,
  isLargeFontMode,
}: Page5Props) => {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleAccidentToggleButtonClick = (hasAccident: boolean) => {
    setFormData((prev) => ({
      ...prev,
      hasAccident,
      accidentChecked: true,
      ...(!hasAccident && { accidentDetail: "", accidentAction: "업무수행" }),
    }));
  };

  const handleSaveButtonClick = () => {
    if (!formData.accidentChecked) {
      onAlert(["사고 유무를 선택해주세요"]);
      return;
    }
    if (formData.hasAccident && !formData.accidentDetail.trim()) {
      onAlert(["사고내용 및 조치내용을 입력해주세요"]);
      return;
    }
    setConfirmOpen(true);
  };

  const handleSaveConfirmButtonClick = async () => {
    setConfirmOpen(false);
    await onSave();
    onNext();
  };

  if (isLargeFontMode) {
    return (
      <>
        <AccidentCheckPageLargeFont
          formData={formData}
          setFormData={setFormData}
          onBack={onBack}
          onSaveButtonClick={handleSaveButtonClick}
        />

        {confirmOpen && (
          <SafetySaveConfirmModal
            hasAccident={formData.hasAccident}
            accidentDetail={formData.accidentDetail}
            accidentAction={formData.accidentAction}
            onConfirm={handleSaveConfirmButtonClick}
          />
        )}
      </>
    );
  }

  return (
    <div className={pageClass}>
      <AppBar title="안전 일지 등록" onBack={onBack} participantId={formData.participantId} />

      <div className={bodyClass}>
        <PageHeaderCard
          icon="/icons/icon-safety.png"
          title="안전 등록"
          subtitle="오늘 안전사고 여부를 확인해주세요"
        />

        <div className="bg-white rounded-[20px] p-[22px] shadow-[0_1px_2px_rgba(20,30,50,0.04)]">
          <label className={labelClass}>오늘 다치신 곳이 있으신가요?</label>
          <div
            className={choiceCardClass(formData.accidentChecked && formData.hasAccident === false)}
            onClick={() => handleAccidentToggleButtonClick(false)}
          >
            <span
              className={choiceRadioClass(
                formData.accidentChecked && formData.hasAccident === false,
              )}
            >
              {formData.accidentChecked && formData.hasAccident === false ? "✓" : ""}
            </span>
            아니요, 없었습니다
          </div>
          <div
            className={choiceCardClass(formData.accidentChecked && formData.hasAccident === true)}
            onClick={() => handleAccidentToggleButtonClick(true)}
            style={{ marginBottom: 0 }}
          >
            <span
              className={choiceRadioClass(
                formData.accidentChecked && formData.hasAccident === true,
              )}
            >
              {formData.accidentChecked && formData.hasAccident === true ? "✓" : ""}
            </span>
            예, 있었습니다
          </div>
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
