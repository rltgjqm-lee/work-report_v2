import BottomSheet from "../atoms/BottomSheet";

interface NotWorkDayModalLargeFontProps {
  onConfirm: () => void;
}

const NotWorkDayModalLargeFont = ({ onConfirm }: NotWorkDayModalLargeFontProps) => (
  <BottomSheet onClose={onConfirm}>
    <div className="text-center">
      <img src="/icons/icon-checkout-clock.png" alt="" className="w-14 h-14 mx-auto mb-4" />
      <div className="text-[24px] font-extrabold text-text-strong leading-[1.5]">
        오늘은 근무일이 아니에요
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

export default NotWorkDayModalLargeFont;
