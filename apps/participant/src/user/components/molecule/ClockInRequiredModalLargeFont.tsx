import BottomSheet from "../atoms/BottomSheet";

interface ClockInRequiredModalLargeFontProps {
  onConfirm: () => void;
}

const ClockInRequiredModalLargeFont = ({ onConfirm }: ClockInRequiredModalLargeFontProps) => (
  <BottomSheet onClose={onConfirm}>
    <div className="text-center">
      <img src="/icons/icon-checkin-clock.png" alt="" className="w-14 h-14 mx-auto mb-4" />
      <div className="text-[24px] font-extrabold text-text-strong leading-[1.5]">
        출근 등록을 먼저 해주세요
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

export default ClockInRequiredModalLargeFont;
