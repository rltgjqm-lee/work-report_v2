import type { ActivityLogFormData } from "../../types/form";

import AppBar from "../../components/appshell/AppBar";
import ProgressBar from "../../components/appshell/ProgressBar";
import Card from "../../components/appshell/Card";
import BottomBar, { BottomBarRow } from "../../components/appshell/BottomBar";
import {
  pageClass,
  bodyClass,
  labelClass,
  labelSmallClass,
  textareaClass,
  btnPrimaryClass,
  btnOutlineClass,
} from "../../components/appshell/classes";

interface Page4Props {
  formData: ActivityLogFormData;
  setFormData: React.Dispatch<React.SetStateAction<ActivityLogFormData>>;
  onBack: () => void;
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
  onBack,
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
    <div className={pageClass}>
      <AppBar title="내용 및 장소" onBack={onBack} />
      <ProgressBar step={3} />
      <div className={bodyClass}>
        <Card>
          <div>
            <label className={labelClass}>
              오늘 무엇을 하셨나요?
              <small className={labelSmallClass}>활동내용</small>
            </label>
            <textarea
              value={formData.actContent}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, actContent: e.target.value }))
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
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, actPlace: e.target.value }))
              }
              className={textareaClass}
              placeholder="활동하신 장소를 적어주세요."
            />
          </div>
        </Card>
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

export default Page4ContentPlace;
