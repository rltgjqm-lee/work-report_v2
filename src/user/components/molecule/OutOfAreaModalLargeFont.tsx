import { formatDistanceM } from "../../utils/geolocation";
import BottomSheet from "../atoms/BottomSheet";

interface OutOfAreaModalLargeFontProps {
  distanceM: number | null;
  onConfirm: () => void;
}

const OutOfAreaModalLargeFont = ({ distanceM, onConfirm }: OutOfAreaModalLargeFontProps) => (
  <BottomSheet onClose={onConfirm}>
    <div className="text-center">
      <img src="/icons/icon-map.png" alt="" className="w-14 h-14 mx-auto mb-4" />
      <div className="text-[24px] font-extrabold text-text-strong leading-[1.5]">
        근무지 밖이에요
      </div>
      <div className="text-[16px] text-text-tertiary font-semibold leading-[1.6] mt-3">
        {distanceM !== null && (
          <>
            근무지까지 약 {formatDistanceM(distanceM)} 남았어요
            <br />
          </>
        )}
        근무지 근처로 이동한 뒤 다시 출근해주세요
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

export default OutOfAreaModalLargeFont;
