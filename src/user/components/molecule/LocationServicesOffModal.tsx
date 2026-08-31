import { createPortal } from "react-dom";
import { AndroidSettings, IOSSettings, NativeSettings } from "capacitor-native-settings";

interface LocationServicesOffModalProps {
  onClose: () => void;
}

const handleOpenLocationSettingsButtonClick = () => {
  // 💡 임시 진단용 — 실기기에서 버튼을 눌러도 설정 화면으로 안 넘어간다는 제보가 있어서,
  // 조용히 무시하던 걸 잠깐 풀고 실제로 뭐가 리턴/에러되는지 화면에 그대로 보여준다.
  // 원인 파악되면 다시 조용히 처리하도록 되돌린다.
  NativeSettings.open({
    optionAndroid: AndroidSettings.Location,
    optionIOS: IOSSettings.LocationServices,
  })
    .then((result) => alert(`설정 열기 결과: ${JSON.stringify(result)}`))
    .catch((error) => alert(`설정 열기 실패: ${error instanceof Error ? error.message : String(error)}`));
};

const LocationServicesOffModal = ({ onClose }: LocationServicesOffModalProps) =>
  createPortal(
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

export default LocationServicesOffModal;
