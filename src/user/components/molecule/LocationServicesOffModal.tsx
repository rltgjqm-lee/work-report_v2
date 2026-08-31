import { createPortal } from "react-dom";
import { AndroidSettings, IOSSettings, NativeSettings } from "capacitor-native-settings";

interface LocationServicesOffModalProps {
  onClose: () => void;
}

const LocationServicesOffModal = ({ onClose }: LocationServicesOffModalProps) => {
  // 💡 설정 화면으로 넘어갔다 돌아왔을 때 이 모달이 그대로 떠있으면 뭘 해야 할지
  // 헷갈린다는 피드백이 있었다 — 설정을 열자마자 모달도 같이 닫아서, 돌아왔을 때 바로
  // 대시보드가 보이고 "출근"만 다시 누르면 되게 한다.
  const handleOpenLocationSettingsButtonClick = () => {
    onClose();
    NativeSettings.open({
      optionAndroid: AndroidSettings.Location,
      optionIOS: IOSSettings.LocationServices,
    }).catch(() => {});
  };

  return createPortal(
    <div className="fixed inset-0 w-full h-full bg-[rgba(20,30,50,0.45)] z-[9999] flex justify-center items-center p-6">
      <div className="bg-white rounded-[20px] px-6 py-7 max-w-[320px] w-full shadow-[0_12px_32px_rgba(20,30,50,0.2)] text-center">
        <img src="/icons/icon-map.png" alt="" className="w-14 h-14 mx-auto mb-3.5" />
        <div className="text-[17px] font-extrabold text-text-strong leading-[1.5]">
          휴대폰 위치 기능이 꺼져있어요
        </div>
        <div className="text-[14.5px] text-text-tertiary font-semibold leading-[1.6] mt-2.5">
          아래 버튼으로 위치 설정을 열고
          <br />
          위치를 켠 뒤 다시 출근해주세요
        </div>

        <button
          onClick={handleOpenLocationSettingsButtonClick}
          className="w-full h-[52px] rounded-[14px] bg-brand text-white text-[16px] font-extrabold border-none mt-5 cursor-pointer"
        >
          위치 설정 열기
        </button>
        <button
          onClick={onClose}
          className="w-full h-[52px] rounded-[14px] bg-white text-text-tertiary text-[15px] font-bold border-none mt-2 cursor-pointer"
        >
          닫기
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default LocationServicesOffModal;
