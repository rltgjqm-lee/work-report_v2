import BottomSheet from "../atoms/BottomSheet";

interface SosIdentificationRequiredModalLargeFontProps {
  onConfirm: () => void;
  // 기본정보(이름 등)를 아직 등록 안 했으면 '기본정보 등록'부터, 이미 등록했지만
  // 본인확인만 안 끝났으면 '활동일지 시작'을 눌러야 한다고 다르게 안내한다.
  isBasicInfoRegistered: boolean;
}

const SosIdentificationRequiredModalLargeFont = ({
  onConfirm,
  isBasicInfoRegistered,
}: SosIdentificationRequiredModalLargeFontProps) => (
  <BottomSheet onClose={onConfirm}>
    <div className="text-center">
      <img src="/icons/icon-basic-info.png" alt="" className="w-14 h-14 mx-auto mb-4" />
      <div className="text-[24px] font-extrabold text-text-strong leading-[1.5]">
        본인 확인 후 사용할 수 있어요
      </div>
      <div className="text-[16px] text-text-tertiary font-semibold leading-[1.6] mt-3">
        {isBasicInfoRegistered ? (
          <>
            <span className="font-extrabold">활동일지 시작</span>에서 본인확인을 진행해주세요
          </>
        ) : (
          <>
            <span className="font-extrabold">기본정보 등록</span>부터 진행해주세요
          </>
        )}
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

export default SosIdentificationRequiredModalLargeFont;
