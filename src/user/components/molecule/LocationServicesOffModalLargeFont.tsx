import { useState } from "react";
import { AndroidSettings, IOSSettings, NativeSettings } from "capacitor-native-settings";
import { Capacitor } from "@capacitor/core";

import { requestEnableLocationServices } from "../../utils/geolocation";
import BottomSheet from "../atoms/BottomSheet";

interface LocationServicesOffModalLargeFontProps {
  onClose: () => void;
  // 위치를 켠 걸 확인하면 호출된다 — 호출부가 출근을 자동으로 다시 시도한다.
  onEnabled: () => void;
}

const LocationServicesOffModalLargeFont = ({
  onClose,
  onEnabled,
}: LocationServicesOffModalLargeFontProps) => {
  const [isRequesting, setIsRequesting] = useState(false);
  // 💡 안드로이드는 설정 화면으로 보내지 않고 앱 안에서 "위치를 켤까요?" 시스템
  // 다이얼로그로 한 번에 켤 수 있다(requestEnableLocationServices). iOS는 애플 정책상
  // 앱이 위치를 대신 켤 수 없어 항상 설정 화면으로 보내야 한다 — 그래서 플랫폼별로
  // 버튼 동작과 문구가 다르다. 모듈 최상단에서 한 번만 계산하면 네이티브 브리지가
  // 아주 살짝이라도 늦게 준비될 때 값이 잘못 굳을 수 있어, 렌더할 때마다 다시 확인한다.
  const isAndroid = Capacitor.getPlatform() === "android";

  const handleOpenLocationSettingsButtonClick = () => {
    onClose();
    NativeSettings.open({
      optionAndroid: AndroidSettings.Location,
      optionIOS: IOSSettings.LocationServices,
    }).catch(() => {});
  };

  const handleEnableButtonClick = async () => {
    setIsRequesting(true);
    const enabled = await requestEnableLocationServices();
    setIsRequesting(false);
    if (enabled) {
      onClose();
      onEnabled();
    }
    // 사용자가 다이얼로그에서 취소했으면 모달은 그대로 두고 다시 시도할 수 있게 한다.
  };

  return (
    <BottomSheet onClose={onClose}>
      <div className="text-center">
        <img src="/icons/icon-map.png" alt="" className="w-14 h-14 mx-auto mb-4" />
        <div className="text-[24px] font-extrabold text-text-strong leading-[1.5]">
          휴대폰 위치 기능이 꺼져있어요
        </div>
        <div className="text-[16px] text-text-tertiary font-semibold leading-[1.6] mt-3">
          {isAndroid ? (
            <>
              아래 버튼을 누르면
              <br />
              바로 위치를 켤 수 있어요
            </>
          ) : (
            <>
              아래 버튼으로 위치 설정을 열고
              <br />
              위치를 켠 뒤 다시 출근해주세요
            </>
          )}
        </div>

        {isAndroid ? (
          <button
            onClick={handleEnableButtonClick}
            disabled={isRequesting}
            className="w-full h-[56px] rounded-[16px] bg-brand text-white text-[18px] font-extrabold border-none mt-6 cursor-pointer disabled:opacity-60"
          >
            {isRequesting ? "확인 중..." : "위치 켜기"}
          </button>
        ) : (
          <button
            onClick={handleOpenLocationSettingsButtonClick}
            className="w-full h-[56px] rounded-[16px] bg-brand text-white text-[18px] font-extrabold border-none mt-6 cursor-pointer"
          >
            위치 설정 열기
          </button>
        )}
        <button
          onClick={onClose}
          className="w-full h-[56px] rounded-[16px] bg-white text-text-tertiary text-[17px] font-bold border border-border-default mt-2.5 cursor-pointer"
        >
          닫기
        </button>
      </div>
    </BottomSheet>
  );
};

export default LocationServicesOffModalLargeFont;
