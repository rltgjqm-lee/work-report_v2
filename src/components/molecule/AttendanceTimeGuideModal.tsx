import { createPortal } from "react-dom";

import Button from "../atoms/Button";

interface AttendanceTimeGuideModalProps {
  now: string;
  shiftStart: string;
  shiftEnd: string;
  onConfirm: () => void;
}

const AttendanceTimeGuideModal = ({
  now,
  shiftStart,
  shiftEnd,
  onConfirm,
}: AttendanceTimeGuideModalProps) =>
  createPortal(
    <div className="fixed inset-0 w-full h-full bg-[rgba(15,23,42,0.45)] z-[9999] flex justify-center items-center p-6">
      <div className="bg-white rounded-[20px] px-6 pt-7 pb-[22px] w-full max-w-[340px] shadow-[0_12px_32px_rgba(20,30,50,0.24)]">
        <p className="text-[18px] font-extrabold text-[#1f2937] leading-[1.5]">
          지금은 <b className="text-[#3182f6]">{now}분</b>이에요.
          <br />
          {shiftStart}에 출근을 완료해주세요.
        </p>

        <div className="bg-[#f9fafb] rounded-[14px] px-4 mt-[18px]">
          <div className="flex items-center justify-between py-[11px] text-[15px] border-b border-[#eef0f3]">
            <span className="text-[#9ca3af] font-bold">업무 시작</span>
            <span className="text-[#1f2937] font-extrabold">{shiftStart}</span>
          </div>
          <div className="flex items-center justify-between py-[11px] text-[15px]">
            <span className="text-[#9ca3af] font-bold">업무 종료</span>
            <span className="text-[#1f2937] font-extrabold">{shiftEnd}</span>
          </div>
        </div>

        <Button variant="primary" onClick={onConfirm} className="mt-5">
          확인
        </Button>
      </div>
    </div>,
    document.body,
  );

export default AttendanceTimeGuideModal;
