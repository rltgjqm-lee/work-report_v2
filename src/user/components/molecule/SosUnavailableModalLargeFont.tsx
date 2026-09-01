import BottomSheet from "../atoms/BottomSheet";

interface SosUnavailableModalLargeFontProps {
  onConfirm: () => void;
}

const SosUnavailableModalLargeFont = ({ onConfirm }: SosUnavailableModalLargeFontProps) => (
  <BottomSheet onClose={onConfirm}>
    <div className="text-center">
      <div className="w-14 h-14 rounded-2xl bg-brand-tint text-brand text-[26px] font-extrabold flex items-center justify-center mx-auto mb-4">
        !
      </div>
      <div className="text-[24px] font-extrabold text-text-strong leading-[1.5]">
        근무 중에만
        <br />
        이용할 수 있어요
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

export default SosUnavailableModalLargeFont;
