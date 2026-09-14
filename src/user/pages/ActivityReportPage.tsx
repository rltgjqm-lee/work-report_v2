import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { ActivityLogFormData } from "../../types/form";

import {
  bodyClass,
  btnOutlineClass,
  btnPrimaryClass,
  labelClass,
  labelSmallClass,
  pageClass,
  textareaClass,
} from "../../components/atoms/classes";

import { activityOptionsQueryOptions } from "../api/activityOptionsApi";
import BottomBar, { BottomBarRow } from "../components/atoms/BottomBar";
import Card from "../components/atoms/Card";
import ActivitySaveConfirmModal from "../components/molecule/ActivitySaveConfirmModal";
import ActivitySaveConfirmModalLargeFont from "../components/molecule/ActivitySaveConfirmModalLargeFont";
import AppBar from "../components/molecule/AppBar";
import Dropdown from "../components/molecule/Dropdown";
import PageHeaderCard from "../components/molecule/PageHeaderCard";
import ActivityReportPageLargeFont from "./ActivityReportPageLargeFont";

// 참여자 앱 <select>가 실제 옵션 라벨과 절대 겹치지 않게 쓰는 "기타" 선택용 sentinel —
// formData나 서버로는 절대 나가지 않고 <select> 자체 value로만 존재한다.
const OTHER_OPTION_VALUE = "__OTHER__";

interface Page4Props {
  formData: ActivityLogFormData;
  setFormData: React.Dispatch<React.SetStateAction<ActivityLogFormData>>;
  onBack: () => void;
  onSave: () => Promise<void>;
  onNext: () => void;
  onAlert: (messages: string[]) => Promise<void>;
  isLargeFontMode: boolean;
}

/**
 * 업무 등록 페이지입니다.
 */
const ActivityReportPage = ({
  formData,
  setFormData,
  onBack,
  onSave,
  onNext,
  onAlert,
  isLargeFontMode,
}: Page4Props) => {
  const [confirmOpen, setConfirmOpen] = useState(false);

  // 활동내용/활동장소 둘 다 사업단 담당자가 미리 등록해둔 항목 중에서 고른다 — 목록에
  // 없으면 "기타"로 직접 입력한다(handleContentOptionChange/handlePlaceOptionChange).
  const { data: activityOptions = [] } = useQuery(activityOptionsQueryOptions(formData.programId));

  const contentOptions = useMemo(
    () => activityOptions.filter((option) => option.category === "CONTENT"),
    [activityOptions],
  );
  const placeOptions = useMemo(
    () => activityOptions.filter((option) => option.category === "PLACE"),
    [activityOptions],
  );

  // "기타"를 방금 골랐지만 아직 아무것도 안 쳤을 때(빈 문자열이라 아래 isXxxUnmatched로는
  // 구분이 안 됨)만 이 state로 따로 표시한다.
  const [isContentOtherSelected, setIsContentOtherSelected] = useState(false);
  const [isPlaceOtherSelected, setIsPlaceOtherSelected] = useState(false);

  // 이미 값이 있는데 지금 옵션 목록엔 없는 경우(이 기능 도입 전에 적어둔 값, 다른
  // 사업단으로 옵션이 바뀐 경우 등)도 기타 입력창으로 보여준다.
  const isContentUnmatched =
    formData.actContent !== "" &&
    !contentOptions.some((option) => option.label === formData.actContent);
  const isPlaceUnmatched =
    formData.actPlace !== "" && !placeOptions.some((option) => option.label === formData.actPlace);

  const showContentOtherInput = isContentOtherSelected || isContentUnmatched;
  const showPlaceOtherInput = isPlaceOtherSelected || isPlaceUnmatched;

  const contentSelectValue = showContentOtherInput ? OTHER_OPTION_VALUE : formData.actContent;
  const placeSelectValue = showPlaceOtherInput ? OTHER_OPTION_VALUE : formData.actPlace;

  const handleContentOptionChange = (value: string) => {
    if (value === OTHER_OPTION_VALUE) {
      setIsContentOtherSelected(true);
      setFormData((prev) => ({ ...prev, actContent: "" }));
      return;
    }
    setIsContentOtherSelected(false);
    setFormData((prev) => ({ ...prev, actContent: value }));
  };

  const handlePlaceOptionChange = (value: string) => {
    if (value === OTHER_OPTION_VALUE) {
      setIsPlaceOtherSelected(true);
      setFormData((prev) => ({ ...prev, actPlace: "" }));
      return;
    }
    setIsPlaceOtherSelected(false);
    setFormData((prev) => ({ ...prev, actPlace: value }));
  };

  const handleSaveButtonClick = () => {
    if (!formData.actContent.trim()) {
      onAlert(["활동 내용을 입력해주세요"]);
      return;
    }
    if (!formData.actPlace.trim()) {
      onAlert(["활동 장소를 입력해주세요"]);
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
        <ActivityReportPageLargeFont
          formData={formData}
          setFormData={setFormData}
          onBack={onBack}
          onSaveButtonClick={handleSaveButtonClick}
          contentOptions={contentOptions}
          placeOptions={placeOptions}
          contentSelectValue={contentSelectValue}
          placeSelectValue={placeSelectValue}
          showContentOtherInput={showContentOtherInput}
          showPlaceOtherInput={showPlaceOtherInput}
          onContentOptionChange={handleContentOptionChange}
          onPlaceOptionChange={handlePlaceOptionChange}
        />

        {confirmOpen && (
          <ActivitySaveConfirmModalLargeFont
            actContent={formData.actContent}
            actPlace={formData.actPlace}
            onConfirm={handleSaveConfirmButtonClick}
          />
        )}
      </>
    );
  }

  return (
    <div className={pageClass}>
      <AppBar title="업무 일지 등록" onBack={onBack} participantId={formData.participantId} />
      <div className={bodyClass}>
        <PageHeaderCard
          icon="/icons/icon-task.png"
          title="업무 등록"
          subtitle="오늘 하신 업무 내용을 남겨주세요"
        />

        <Card>
          <div>
            <label className={labelClass}>
              오늘 무엇을 하셨나요?
              <small className={labelSmallClass}>활동내용</small>
            </label>
            <Dropdown
              value={contentSelectValue}
              onChange={handleContentOptionChange}
              options={[
                { value: "", label: "선택해주세요", disabled: true },
                ...contentOptions.map((option) => ({ value: option.label, label: option.label })),
                { value: OTHER_OPTION_VALUE, label: "기타" },
              ]}
            />
            {showContentOtherInput && (
              <textarea
                value={formData.actContent}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    actContent: event.target.value,
                  }))
                }
                className={`${textareaClass} mt-2.5`}
                placeholder="오늘 수행하신 활동 내용을 적어주세요."
              />
            )}
          </div>

          <div>
            <label className={labelClass}>
              어디에서 하셨나요?
              <small className={labelSmallClass}>활동장소</small>
            </label>
            <Dropdown
              value={placeSelectValue}
              onChange={handlePlaceOptionChange}
              options={[
                { value: "", label: "선택해주세요", disabled: true },
                ...placeOptions.map((option) => ({ value: option.label, label: option.label })),
                { value: OTHER_OPTION_VALUE, label: "기타" },
              ]}
            />
            {showPlaceOtherInput && (
              <textarea
                value={formData.actPlace}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    actPlace: event.target.value,
                  }))
                }
                className={`${textareaClass} mt-2.5`}
                placeholder="활동하신 장소를 적어주세요."
              />
            )}
          </div>
        </Card>
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
        <ActivitySaveConfirmModal
          actContent={formData.actContent}
          actPlace={formData.actPlace}
          onConfirm={handleSaveConfirmButtonClick}
        />
      )}
    </div>
  );
};

export default ActivityReportPage;
