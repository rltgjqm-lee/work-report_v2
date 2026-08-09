import { createPortal } from "react-dom";

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
    <div className="fixed inset-0 w-full h-full bg-[rgba(20,30,50,0.45)] z-[9999] flex justify-center items-center p-6">
      <div className="bg-white rounded-[20px] px-6 py-7 max-w-[320px] w-full shadow-[0_12px_32px_rgba(20,30,50,0.2)] text-center">
        <img src="/icon-checkin-clock.png" alt="" className="w-14 h-14 mx-auto mb-3.5" />
        <div className="text-[17px] font-extrabold text-[#1f2937] leading-[1.5]">
          지금은 <b>{now}분</b>이에요
          <br />
          {shiftStart}에 출근을 완료해주세요
        </div>

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

        <button
          onClick={onConfirm}
          className="w-full h-[52px] rounded-[14px] bg-[#3182f6] text-white text-[16px] font-extrabold border-none mt-5 cursor-pointer"
        >
          확인
        </button>
      </div>
    </div>,
    document.body,
  );

export default AttendanceTimeGuideModal;
