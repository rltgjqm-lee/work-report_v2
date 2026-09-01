import BottomSheet from "../atoms/BottomSheet";

interface AttendanceTimeGuideModalLargeFontProps {
  now: string;
  shiftStart: string;
  shiftEnd: string;
  onConfirm: () => void;
}

const AttendanceTimeGuideModalLargeFont = ({
  now,
  shiftStart,
  shiftEnd,
  onConfirm,
}: AttendanceTimeGuideModalLargeFontProps) => (
  <BottomSheet onClose={onConfirm}>
    <div className="text-center">
      <img src="/icons/icon-checkin-clock.png" alt="" className="w-14 h-14 mx-auto mb-4" />
      <div className="text-[24px] font-extrabold text-text-strong leading-[1.5]">
        지금은 <b>{now}분</b>이에요
        <br />
        {shiftStart}에 출근을 완료해주세요
      </div>

      <div className="bg-surface-muted rounded-[14px] px-4 mt-2">
        <div className="flex items-center justify-between py-3 text-[17px] border-b border-border-faint">
          <span className="text-text-tertiary font-bold">업무 시작</span>
          <span className="text-text-strong font-extrabold">{shiftStart}</span>
        </div>
        <div className="flex items-center justify-between py-3 text-[17px]">
          <span className="text-text-tertiary font-bold">업무 종료</span>
          <span className="text-text-strong font-extrabold">{shiftEnd}</span>
        </div>
      </div>

      <button
        onClick={onConfirm}
        className="w-full h-[56px] rounded-[16px] bg-brand text-white text-[18px] font-extrabold border-none mt-6 cursor-pointer"
      >
        확인
      </button>
    </div>
  </BottomSheet>
);

export default AttendanceTimeGuideModalLargeFont;
