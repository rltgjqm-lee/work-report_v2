import BottomSheet from "../atoms/BottomSheet";

interface LocationConsentModalProps {
  onConfirm: () => void;
  isLargeFontMode: boolean;
}

const LocationConsentModal = ({ onConfirm, isLargeFontMode }: LocationConsentModalProps) => (
  // 위치 수집 동의는 배경을 탭한다고 묵시적으로 동의 처리되면 안 되므로, 원래
  // center-card 버전처럼 "확인" 버튼을 눌러야만 닫히게 한다(BottomSheet의 배경 탭
  // 닫힘은 비활성화).
  <BottomSheet onClose={() => {}}>
    <div className="text-center">
      <img src="/icons/icon-map.png" alt="" className="w-14 h-14 mx-auto mb-3.5" />
      <div
        className={`font-extrabold text-text-strong leading-[1.5] ${isLargeFontMode ? "text-[24px]" : "text-[18px]"}`}
      >
        근무 중 위치가 확인돼요
      </div>
      <div
        className={`text-text-tertiary font-semibold leading-[1.6] ${isLargeFontMode ? "text-[16px] mt-2" : "text-[14.5px] mt-2.5"}`}
      >
        {isLargeFontMode ? (
          <>
            출근 후 올바른 근무지에서
            <br />
            <span className="font-extrabold">안전</span>하게 일하고 계신지 확인하기 위해
            <br />
            위치를 주기적으로 체크하고 있어요
          </>
        ) : (
          <>
            출근 후 올바른 근무지에서 <span className="font-extrabold">안전</span>하게 일하고
            계신지
            <br />
            확인하기 위해 위치를 주기적으로 체크하고 있어요
          </>
        )}
        <br />
        퇴근 후 위치 확인이 즉시 중단돼요
      </div>

      <button
        onClick={onConfirm}
        className={`w-full font-extrabold bg-brand text-white border-none cursor-pointer ${
          isLargeFontMode
            ? "h-[56px] rounded-[16px] text-[18px] mt-6"
            : "h-[52px] rounded-[14px] text-[16px] mt-5"
        }`}
      >
        확인
      </button>
    </div>
  </BottomSheet>
);

export default LocationConsentModal;
