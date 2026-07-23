import React from "react";

import type { ActivityLogFormData } from "../../types/form";
import { downloadActivityLogPdf } from "../../utils/downloadActivityLogPdf";
import AppBar from "../../components/molecule/AppBar";
import ProgressBar from "../../components/atoms/ProgressBar";
import Card from "../../components/atoms/Card";
import BottomBar, { BottomBarRow } from "../../components/atoms/BottomBar";
import SignatureCanvas from "../../components/atoms/SignatureCanvas";
import {
  pageClass,
  bodyClass,
  labelClass,
  labelSmallClass,
  checkRowClass,
  btnPrimaryClass,
  btnOutlineClass,
} from "../../components/atoms/classes";

interface Page6Props {
  formData: ActivityLogFormData;
  setFormData: React.Dispatch<React.SetStateAction<ActivityLogFormData>>;
  printRef: React.RefObject<HTMLDivElement | null>; // 💡 PDF 인쇄 대상을 조준할 Ref
  onBack: () => void;
  onSave: () => void;
  onHome: () => void;
  onAlert: (messages: string[]) => void;
}

const SignaturePage = ({
  formData,
  setFormData,
  printRef,
  onBack,
  onSave,
  onHome,
  onAlert,
}: Page6Props) => {
  // 🔥 [내장형 보고서 출력 핵심 로직] 6페이지 내부에서 직접 연산 및 파일 다운로드 처리
  const handleExportReportsButtonClick = async () => {
    // 1. 참여자 필수 서명 가드 확인
    if (!formData.userSignature) {
      onAlert(["참여자 서명이 누락되었습니다. 서명을 작성해주세요."]);
      return;
    }

    // 2. 부모가 꽂아준 히든 인쇄용 돔 타겟팅 확인
    if (!printRef.current) {
      onAlert(["인쇄 대상을 찾을 수 없습니다. 시스템 오류입니다."]);
      return;
    }

    try {
      // 3. 파일 이름 동적 포맷팅
      const baseFileName = `${formData.actDate}_활동일지_${formData.userName || "미지정"}`;

      // 4. [PDF 인쇄] 유틸 함수 호출하여 즉시 떨구기
      await downloadActivityLogPdf({
        element: printRef.current,
        fileName: `${baseFileName}.pdf`,
      });

      onAlert(["🎉 보고서(PDF) 출력이 완료되었습니다!"]);
    } catch (error) {
      console.error("보고서 생성 실패:", error);
      onAlert(["보고서 다운로드 중 오류가 발생했습니다."]);
    }
  };

  return (
    <div className={pageClass}>
      <AppBar title="서명" onBack={onBack} />
      <ProgressBar step={5} />
      <div className={bodyClass}>
        <Card>
          <label className={labelClass}>
            여기에 서명해 주세요 (필수)
            <small className={labelSmallClass}>
              최초 서명 시 이후 계속 사용됩니다
            </small>
          </label>
          <SignatureCanvas
            value={formData.userSignature}
            onChange={(dataUrl) =>
              setFormData((prev) => ({ ...prev, userSignature: dataUrl }))
            }
          />
        </Card>

        <Card>
          <label className={labelClass}>
            확인자 서명
            <small className={labelSmallClass}>선택 사항이에요</small>
          </label>
          <SignatureCanvas
            value={formData.demandSignature}
            onChange={(dataUrl) =>
              setFormData((prev) => ({ ...prev, demandSignature: dataUrl }))
            }
          />
        </Card>

        <Card>
          <label className={checkRowClass + " cursor-pointer select-none"}>
            <input
              type="checkbox"
              checked={formData.saveSignatureConsent}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  saveSignatureConsent: event.target.checked,
                }))
              }
              className="w-6 h-6 mt-0.5 accent-[#3182f6] flex-none"
            />
            <span>
              이 서명을 다음에도 계속 사용할게요
              <br />
              <span className="text-[13px] text-[#9ca3af] font-normal">
                (체크 해제 시 다음 작성 시 서명이 지워진 채로 시작합니다)
              </span>
            </span>
          </label>
        </Card>
      </div>

      <BottomBar>
        <button className={btnPrimaryClass} onClick={onSave}>
          저장하고 마치기
        </button>
        <BottomBarRow>
          <button
            className={btnOutlineClass}
            onClick={handleExportReportsButtonClick}
          >
            보고서 출력
          </button>
          <button className={btnOutlineClass} onClick={onHome}>
            처음으로
          </button>
        </BottomBarRow>
      </BottomBar>
    </div>
  );
};

export default SignaturePage;
