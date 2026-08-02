import { createPortal } from "react-dom";

import Button from "../atoms/Button";

interface ClockInCompleteModalProps {
  startTime: string;
  onConfirm: () => void;
}

const ClockInCompleteModal = ({ startTime, onConfirm }: ClockInCompleteModalProps) =>
  createPortal(
    <div className="fixed inset-0 w-full h-full bg-[rgba(15,23,42,0.45)] z-[9999] flex justify-center items-center p-6">
      <div className="bg-white rounded-[20px] px-6 pt-7 pb-[22px] w-full max-w-[340px] shadow-[0_12px_32px_rgba(20,30,50,0.24)]">
        <p className="text-[18px] font-semibold text-[#1f2937] leading-[1.5]">
          <b className="text-[#3182f6]">{startTime}</b>에 정상적으로 출근 완료했어요
          <br />
          오늘도 안전하게 활동을 진행해주세요
        </p>

        <Button variant="primary" onClick={onConfirm} className="w-full mt-5">
          확인
        </Button>
      </div>
    </div>,
    document.body,
  );

export default ClockInCompleteModal;
