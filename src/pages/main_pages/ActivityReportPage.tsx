import type { ActivityLogFormData } from "../../types/form";

import AppBar from "../../components/molecule/AppBar";
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
  onAlert: (messages: string[]) => void;
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
  const handleSaveButtonClick = async () => {
    if (!formData.actContent.trim()) {
      onAlert(["활동 내용을 입력해주세요."]);
      return;
    }
    if (!formData.actPlace.trim()) {
      onAlert(["활동 장소를 입력해주세요."]);
      return;
    }
    // 💡 저장 완료 알럿을 확인(OK)하기 전까지는 홈으로 넘어가지 않도록 await로 순서를 보장한다.
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
            취소
          </button>
          <button
            className={btnPrimaryClass + " flex-1"}
            onClick={handleSaveButtonClick}
          >
            저장
          </button>
        </BottomBarRow>
      </BottomBar>
    </div>
  );
};

export default ActivityReportPage;
