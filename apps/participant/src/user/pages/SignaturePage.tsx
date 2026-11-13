import React, { useState } from "react";

import type { ActivityLogFormData } from "@work-report/shared/types/form";

import {
  bodyClass,
  btnPrimaryClass,
  labelClass,
  labelSmallClass,
  pageClass,
} from "@work-report/shared/components/atoms/classes";

import BottomBar from "../components/atoms/BottomBar";
import Card from "../components/atoms/Card";
import SignatureCanvas from "../components/atoms/SignatureCanvas";
import AppBar from "../components/molecule/AppBar";
import PageHeaderCard from "../components/molecule/PageHeaderCard";
import type { ActivityLogSaveResult } from "../utils/activityLogSync";
import SignaturePageLargeFont from "./SignaturePageLargeFont";

interface Page6Props {
  formData: ActivityLogFormData;
  setFormData: React.Dispatch<React.SetStateAction<ActivityLogFormData>>;
  onBack: () => void;
  onSave: () => Promise<ActivityLogSaveResult>;
  onHome: () => void;
  onAlert: (messages: string[]) => Promise<void>;
  isLargeFontMode: boolean;
}

const SignaturePage = ({
  formData,
  setFormData,
  onBack,
  onSave,
  onHome,
  onAlert,
  isLargeFontMode,
}: Page6Props) => {
  // 서버 전송 결과를 기다리는 동안 — 버튼을 "전송 중…"으로 바꾸고 다시 못 누르게 한다
  const [isSending, setIsSending] = useState(false);

  const handleSaveAndFinishButtonClick = async () => {
    if (isSending) return;
    if (!formData.userSignature) {
      onAlert(["참여자 서명이 누락되었습니다", "서명을 작성해주세요"]);
      return;
    }

    setIsSending(true);
    const saveResult = await onSave();
    setIsSending(false);

    if (saveResult === "failed") return;

    if (saveResult === "unsent") {
      // 폰에는 저장됐으니 다음에 앱을 열 때 다시 보낸다 — 그 전에 앱을 지우거나 폰을 바꾸면
      // 사라지므로, 참여자가 인터넷을 켜고 앱을 다시 열어야 한다는 걸 알게 한다.
      await onAlert(["아직 서버에 전송되지 않았어요", "인터넷을 켜고 앱을 다시 열어주세요"]);
    } else if (!formData.demandSignature) {
      await onAlert(["월말 제출을 위해 확인자 서명이 필요해요"]);
    }

    onHome();
  };

  if (isLargeFontMode) {
    return (
      <SignaturePageLargeFont
        formData={formData}
        setFormData={setFormData}
        onBack={onBack}
        onSaveAndFinishButtonClick={handleSaveAndFinishButtonClick}
        isSending={isSending}
      />
    );
  }

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
        <button
          className={btnPrimaryClass}
          onClick={handleSaveAndFinishButtonClick}
          disabled={isSending}
        >
          {isSending ? "전송 중…" : "저장하고 마치기"}
        </button>
      </BottomBar>
    </div>
  );
};

export default SignaturePage;
