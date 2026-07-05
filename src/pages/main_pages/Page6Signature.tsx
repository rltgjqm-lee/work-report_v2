import React, { useEffect, useRef } from "react";
import Button from "../../components/atoms/Button";
import type { ActivityLogFormData } from "../../types/form";
import { downloadActivityLogPdf } from "../../utils/downloadActivityLogPdf";

interface Page6Props {
  formData: ActivityLogFormData;
  setFormData: React.Dispatch<React.SetStateAction<ActivityLogFormData>>;
  printRef: React.RefObject<HTMLDivElement | null>; // 💡 PDF 인쇄 대상을 조준할 Ref
  onSave: () => void;
  onHome: () => void;
  onAlert: (messages: string[]) => void;
}

const Page6Signature = ({
  formData,
  setFormData,
  printRef,
  onSave,
  onHome,
  onAlert,
}: Page6Props) => {
  const userCanvasRef = useRef<HTMLCanvasElement>(null);
  const demandCanvasRef = useRef<HTMLCanvasElement>(null);

  // 💡 [Canvas 그림판 초기화 이펙트] 마운트 시 1회만 실행 (서명 저장으로 인한 재초기화 방지)
  useEffect(() => {
    const initCanvas = (
      canvas: HTMLCanvasElement,
      key: "userSignature" | "demandSignature",
    ) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return () => {};

      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#000000";

      let isDrawing = false;

      const getPos = (e: MouseEvent | TouchEvent) => {
        const r = canvas.getBoundingClientRect();
        if ("touches" in e) {
          if (e.touches.length === 0) return { x: 0, y: 0 };
          return {
            x: e.touches[0].clientX - r.left,
            y: e.touches[0].clientY - r.top,
          };
        }
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      };

      const startDrawing = (e: MouseEvent | TouchEvent) => {
        isDrawing = true;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
      };

      const draw = (e: MouseEvent | TouchEvent) => {
        if (!isDrawing) return;
        e.preventDefault();
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      };

      const stopDrawing = () => {
        if (!isDrawing) return;
        isDrawing = false;
        const dataUrl = canvas.toDataURL("image/png");
        setFormData((prev) => ({ ...prev, [key]: dataUrl }));
      };

      canvas.addEventListener("mousedown", startDrawing);
      canvas.addEventListener("mousemove", draw);
      canvas.addEventListener("mouseup", stopDrawing);
      canvas.addEventListener("mouseleave", stopDrawing);
      canvas.addEventListener("touchstart", startDrawing, { passive: false });
      canvas.addEventListener("touchmove", draw, { passive: false });
      canvas.addEventListener("touchend", stopDrawing);

      const savedSign = formData[key];
      if (savedSign && savedSign.startsWith("data:image")) {
        const img = new Image();
        img.onload = () =>
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        img.src = savedSign;
      }

      return () => {
        canvas.removeEventListener("mousedown", startDrawing);
        canvas.removeEventListener("mousemove", draw);
        canvas.removeEventListener("mouseup", stopDrawing);
        canvas.removeEventListener("mouseleave", stopDrawing);
        canvas.removeEventListener("touchstart", startDrawing);
        canvas.removeEventListener("touchmove", draw);
        canvas.removeEventListener("touchend", stopDrawing);
      };
    };

    const cleanups: Array<() => void> = [];
    if (userCanvasRef.current)
      cleanups.push(initCanvas(userCanvasRef.current, "userSignature"));
    if (demandCanvasRef.current)
      cleanups.push(initCanvas(demandCanvasRef.current, "demandSignature"));

    return () => cleanups.forEach((cleanup) => cleanup());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 💡 [그림판 클리어 핸들러]
  const handleClearCanvas = (
    ref: React.RefObject<HTMLCanvasElement | null>,
    key: "userSignature" | "demandSignature",
  ) => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setFormData((prev) => ({ ...prev, [key]: "" }));
  };

  // 🔥 [내장형 보고서 출력 핵심 로직] 6페이지 내부에서 직접 연산 및 파일 다운로드 처리
  const handleExportReports = async () => {
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

      alert("🎉 보고서(PDF) 출력이 완료되었습니다!");
    } catch (error) {
      console.error("보고서 생성 실패:", error);
      onAlert(["보고서 다운로드 중 오류가 발생했습니다."]);
    }
  };

  return (
    <div
      className="p-[30px_20px] flex flex-1 flex-col max-[600px]:p-[20px_15px]"
      id="page6"
    >
      <div className="text-[22px] font-bold mb-[25px] text-[#2c3e50] text-left tracking-[-0.5px] max-[600px]:text-[20px] max-[600px]:mb-[18px]">
        서명을 진행해주세요
      </div>

      {/* 참여자 서명 */}
      <div className="flex flex-col items-start mb-1 gap-2.5 w-full">
        <div className="text-[16px] font-bold w-full text-[#34495e] flex-none max-[600px]:text-[15px] max-[600px]:mb-[2px]">
          참여자 서명{" "}
          <span className="text-[12px] font-normal text-[#e74c3c]">
            (*필수)
          </span>
        </div>
        <div className="border-2 border-dashed border-[#bdc3c7] rounded-xl bg-[#fafafa] relative w-full h-[180px] max-[600px]:h-[120px] mb-0">
          <canvas
            ref={userCanvasRef}
            className="w-full h-full rounded-xl touch-none"
          />
          <button
            onClick={() => handleClearCanvas(userCanvasRef, "userSignature")}
            className="absolute top-1.5 right-1.5 bg-[#ff4d4d] text-white border-none rounded p-1 text-[12px] z-20 cursor-pointer hover:bg-[#e04343]"
          >
            지우기
          </button>
        </div>
      </div>
      <div className="text-[13px] text-[#7f8c8d] text-right mb-[25px] w-full">
        * 최초 서명 시 이후 계속 사용됩니다.
      </div>

      {/* 확인자 서명 */}
      <div className="flex flex-col items-start mb-1 gap-2.5 w-full">
        <div className="text-[16px] font-bold w-full text-[#34495e] flex-none max-[600px]:text-[15px] max-[600px]:mb-[2px]">
          확인자 (수요처) 서명{" "}
          <span className="text-[14px] font-normal">(선택)</span>
        </div>
        <div className="border-2 border-dashed border-[#bdc3c7] rounded-xl bg-[#fafafa] relative w-full h-[180px] max-[600px]:h-[120px] mb-0">
          <canvas
            ref={demandCanvasRef}
            className="w-full h-full rounded-xl touch-none"
          />
          <button
            onClick={() =>
              handleClearCanvas(demandCanvasRef, "demandSignature")
            }
            className="absolute top-1.5 right-1.5 bg-[#ff4d4d] text-white border-none rounded p-1 text-[12px] z-20 cursor-pointer hover:bg-[#e04343]"
          >
            지우기
          </button>
        </div>
      </div>

      {/* 서명 보존 동의 */}
      <label className="flex items-start gap-2 mb-[25px] cursor-pointer mt-3 w-full select-none">
        <input
          type="checkbox"
          id="demandConsentCheck"
          checked={formData.saveSignatureConsent}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              saveSignatureConsent: e.target.checked,
            }))
          }
          className="w-[18px] h-[18px] mt-0.5"
        />
        <div className="text-[14px] text-[#2c3e50] text-left">
          <strong>이 서명으로 계속 사용함에 동의합니다.</strong> <br />
          <span className="text-[12px] text-[#7f8c8d]">
            (체크 해제 시 다음 작성 시 서명이 지워진 채로 시작합니다)
          </span>
        </div>
      </label>

      {/* 제어 액션 패널 */}
      <div className="flex justify-center gap-2 mt-auto pt-5 max-[600px]:mt-5 max-[600px]:pt-0">
        <Button variant="blue" onClick={onSave}>
          저장하기
        </Button>
        <Button variant="white" onClick={handleExportReports}>
          {" "}
          {/* 🔥 연동 변경 */}
          보고서 출력
        </Button>
        <Button variant="white" onClick={onHome}>
          처음으로
        </Button>
      </div>
    </div>
  );
};

export default Page6Signature;
