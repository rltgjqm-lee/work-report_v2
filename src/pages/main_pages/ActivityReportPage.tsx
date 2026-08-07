import { useEffect, useState } from "react";

import type { ActivityLogFormData } from "../../types/form";

import AppBar from "../../components/molecule/AppBar";
import ActivitySaveConfirmModal from "../../components/molecule/ActivitySaveConfirmModal";
import Card from "../../components/atoms/Card";
import BottomBar, { BottomBarRow } from "../../components/atoms/BottomBar";
import {
  pageClass,
  bodyClass,
  labelClass,
  labelSmallClass,
  textareaClass,
  btnPrimaryClass,
  btnOutlineClass,
} from "../../components/atoms/classes";

interface Page4Props {
  formData: ActivityLogFormData;
  setFormData: React.Dispatch<React.SetStateAction<ActivityLogFormData>>;
  onBack: () => void; // 💡 홈으로 돌아가기(취소)
  onSave: () => Promise<void>; // 💡 IndexedDB 임시저장 브릿지
  onNext: () => void; // 💡 저장 후 홈으로 돌아가기
  onAlert: (messages: string[]) => Promise<void>;
}

/**
 * 업무 등록 모듈 — 홈 대시보드에서 진입, 저장하면 다시 홈으로 돌아간다.
 */
const ActivityReportPage = ({
  formData,
  setFormData,
  onBack,
  onSave,
  onNext,
  onAlert,
}: Page4Props) => {
  const [confirmOpen, setConfirmOpen] = useState(false);

  // 💡 아직 안 적었으면 사업단명/수요처명을 기본값으로 채워둔다 — 참여자는 그대로 쓰거나
  // 고쳐 쓸 수 있다. 이미 적은 내용은 덮어쓰지 않는다.
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      actContent: prev.actContent || prev.programName,
      actPlace: prev.actPlace || prev.demandName,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveButtonClick = () => {
    if (!formData.actContent.trim()) {
      onAlert(["활동 내용을 입력해주세요."]);
      return;
    }
    if (!formData.actPlace.trim()) {
      onAlert(["활동 장소를 입력해주세요."]);
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
      <AppBar title="업무 일지 등록" onBack={onBack} />
      <div className={bodyClass}>
        <Card>
          <div>
            <label className={labelClass}>
              오늘 무엇을 하셨나요?
              <small className={labelSmallClass}>활동내용</small>
            </label>
            <textarea
              value={formData.actContent}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  actContent: event.target.value,
                }))
              }
              className={textareaClass}
              placeholder="오늘 수행하신 활동 내용을 적어주세요."
            />
          </div>

          <div>
            <label className={labelClass}>
              어디에서 하셨나요?
              <small className={labelSmallClass}>활동장소</small>
            </label>
            <textarea
              value={formData.actPlace}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  actPlace: event.target.value,
                }))
              }
              className={textareaClass}
              placeholder="활동하신 장소를 적어주세요."
            />
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
