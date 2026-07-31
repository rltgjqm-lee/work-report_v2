import React from "react";

import type { ActivityLogFormData } from "../../types/form";
import AppBar from "../../components/molecule/AppBar";
import Card from "../../components/atoms/Card";
import BottomBar from "../../components/atoms/BottomBar";
import SignatureCanvas from "../../components/atoms/SignatureCanvas";
import {
  pageClass,
  bodyClass,
  labelClass,
  labelSmallClass,
  btnPrimaryClass,
} from "../../components/atoms/classes";

interface Page6Props {
  formData: ActivityLogFormData;
  setFormData: React.Dispatch<React.SetStateAction<ActivityLogFormData>>;
  onBack: () => void;
  onSave: () => Promise<void>;
  onHome: () => void;
  onAlert: (messages: string[]) => Promise<void>;
}

const SignaturePage = ({ formData, setFormData, onBack, onSave, onHome, onAlert }: Page6Props) => {
  const handleSaveAndFinishButtonClick = async () => {
    if (!formData.userSignature) {
      onAlert(["참여자 서명이 누락되었습니다. 서명을 작성해주세요."]);
      return;
    }

    await onSave();

    if (!formData.demandSignature) {
      // 💡 "확인" 누를 때까지 기다렸다가 홈으로 이동한다.
      await onAlert(["월말 제출을 위해 확인자 서명이 필요해요."]);
    }

    onHome();
  };

  return (
    <div className={pageClass}>
      <AppBar title="서명" onBack={onBack} />
      <div className={bodyClass}>
        <Card>
          <label className={labelClass}>
            여기에 서명해 주세요 (필수)
            <small className={labelSmallClass}>매일 새로 서명해야 해요</small>
          </label>
          <SignatureCanvas
            value={formData.userSignature}
            onChange={(dataUrl) => setFormData((prev) => ({ ...prev, userSignature: dataUrl }))}
          />
        </Card>

        <Card>
          <label className={labelClass}>
            확인자 서명
            <small className={labelSmallClass}>선택 사항이에요</small>
          </label>
          <SignatureCanvas
            value={formData.demandSignature}
            onChange={(dataUrl) => setFormData((prev) => ({ ...prev, demandSignature: dataUrl }))}
          />
        </Card>
      </div>

      <BottomBar>
        <button className={btnPrimaryClass} onClick={handleSaveAndFinishButtonClick}>
          저장하고 마치기
        </button>
      </BottomBar>
    </div>
  );
};

export default SignaturePage;
