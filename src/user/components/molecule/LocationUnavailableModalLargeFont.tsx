import BottomSheet from "../atoms/BottomSheet";

interface LocationUnavailableModalLargeFontProps {
  onConfirm: () => void;
}

const LocationUnavailableModalLargeFont = ({ onConfirm }: LocationUnavailableModalLargeFontProps) => (
  <BottomSheet onClose={onConfirm}>
    <div className="text-center">
      <img src="/icons/icon-map.png" alt="" className="w-14 h-14 mx-auto mb-4" />
      <div className="text-[24px] font-extrabold text-text-strong leading-[1.5]">
        위치를 확인하지 못했어요
      </div>
      <div className="text-[16px] text-text-tertiary font-semibold leading-[1.6] mt-3">
        잠시 후 출근 버튼을 다시 눌러주세요
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

export default LocationUnavailableModalLargeFont;
