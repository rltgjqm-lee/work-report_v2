import { AndroidSettings, IOSSettings, NativeSettings } from "capacitor-native-settings";

import BottomSheet from "../atoms/BottomSheet";

interface LocationPermissionDeniedModalLargeFontProps {
  onClose: () => void;
}

const handleOpenSettingsButtonClick = () => {
  // 웹 미리보기에는 구현이 없어 항상 실패한다 — 실제 기기(안드로이드/iOS) 빌드에서만
  // 의미가 있으므로 여기서는 조용히 무시한다.
  NativeSettings.open({
    optionAndroid: AndroidSettings.ApplicationDetails,
    optionIOS: IOSSettings.App,
  }).catch(() => {});
};

const LocationPermissionDeniedModalLargeFont = ({
  onClose,
}: LocationPermissionDeniedModalLargeFontProps) => (
  <BottomSheet onClose={onClose}>
    <div className="text-center">
      <img src="/icons/icon-map.png" alt="" className="w-14 h-14 mx-auto mb-4" />
      <div className="text-[24px] font-extrabold text-text-strong leading-[1.5]">
        위치 권한이 꺼져있어요
      </div>
      <div className="text-[16px] text-text-tertiary font-semibold leading-[1.6] mt-3">
        설정 열기 버튼을 클릭한 후
        <br />
        위치 권한을 허용해주세요
      </div>

      <button
        onClick={handleOpenSettingsButtonClick}
        className="w-full h-[56px] rounded-[16px] bg-brand text-white text-[18px] font-extrabold border-none mt-6 cursor-pointer"
      >
        설정 열기
      </button>
      <button
        onClick={onClose}
        className="w-full h-[56px] rounded-[16px] bg-white text-text-tertiary text-[17px] font-bold border border-border-default mt-2.5 cursor-pointer"
      >
        닫기
      </button>
    </div>
  </BottomSheet>
);

export default LocationPermissionDeniedModalLargeFont;
