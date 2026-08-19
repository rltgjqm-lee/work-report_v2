import React from "react";

import type { ActivityLogFormData } from "../../types/form";

import {
  bodyClass,
  btnPrimaryClass,
  labelClass,
  labelSmallClass,
  pageClass,
} from "../../components/atoms/classes";

import BottomBar from "../components/atoms/BottomBar";
import Card from "../components/atoms/Card";
import SignatureCanvas from "../components/atoms/SignatureCanvas";
import AppBar from "../components/molecule/AppBar";
import PageHeaderCard from "../components/molecule/PageHeaderCard";

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
      onAlert(["참여자 서명이 누락되었습니다", "서명을 작성해주세요"]);
      return;
    }

    await onSave();

    if (!formData.demandSignature) {
      await onAlert(["월말 제출을 위해 확인자 서명이 필요해요"]);
    }

    onHome();
  };

  return (
    <div className={pageClass}>
      <AppBar title="서명" onBack={onBack} participantId={formData.participantId} />
      <div className={bodyClass}>
        <PageHeaderCard
          icon="/icons/icon-signature.png"
          title="참여자 서명"
          subtitle="서명을 남기고 활동일지를 완료해주세요"
        />

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
