import BottomSheet from "../atoms/BottomSheet";

interface ClockOutTooEarlyModalLargeFontProps {
  shiftEnd: string;
  onConfirm: () => void;
}

const ClockOutTooEarlyModalLargeFont = ({
  shiftEnd,
  onConfirm,
}: ClockOutTooEarlyModalLargeFontProps) => (
  <BottomSheet onClose={onConfirm}>
    <div className="text-center">
      <img src="/icons/icon-checkout-clock.png" alt="" className="w-14 h-14 mx-auto mb-4" />
      <div className="text-[24px] font-extrabold text-text-strong leading-[1.5]">
        아직 근무 종료 시간이 아니에요
      </div>
      <div className="text-[16px] text-text-tertiary font-semibold leading-[1.6] mt-2">
        <b>{shiftEnd}</b>에 퇴근해주세요
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

export default ClockOutTooEarlyModalLargeFont;
