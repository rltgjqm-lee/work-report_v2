import { useState } from "react";

import Button from "../components/atoms/Button";
import ConfirmModal from "../components/molecule/ConfirmModal";

import { LOCAL_STORAGE_KEYS } from "../constants/storage";
import { startGeofenceTracking, stopGeofenceTracking } from "../utils/geofence";

const Admin = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessages, setModalMessages] = useState<string[]>([]);

  // functions
  const openAlertModal = (messages: string[]) => {
    setModalMessages(messages);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const handleClickTestFarLocationButton = () => {
    if (!("geolocation" in navigator)) {
      openAlertModal(["이 브라우저는 위치 서비스를 지원하지 않습니다."]);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        // 위도 0.1도 ≈ 11.1km 이므로 실제 위치에서 10km 이상 떨어진 지점을 기준점으로 설정
        const farLat = latitude + 0.1;

        localStorage.setItem(LOCAL_STORAGE_KEYS.TARGET_LAT, farLat.toString());
        localStorage.setItem(
          LOCAL_STORAGE_KEYS.TARGET_LON,
          longitude.toString(),
        );

        // 💡 이전 테스트에서 이미 알람이 떴다면 추적이 꺼져있으므로, 새로고침 없이 재시작
        stopGeofenceTracking();
        startGeofenceTracking();

        openAlertModal([
          "[테스트] 기준 위치가 현재 위치에서 10km 이상 떨어진 지점으로 설정되었습니다.",
          // "앱을 새로고침하면 반경 이탈 알림이 즉시 발생합니다.",
        ]);
      },
      (error) => {
        console.error("현재 위치를 가져오지 못했습니다:", error);
        openAlertModal(["현재 위치를 가져오지 못했습니다."]);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  return (
    <div>
      <p className="text-[26px] p-3">테스트 페이지 입니다. </p>

      {/* 지오펜싱 테스트 버튼 */}
      <div className="flex justify-center px-3">
        <Button
          variant="blue"
          onClick={handleClickTestFarLocationButton}
          className="!flex-none w-full"
        >
          [테스트] 반경 10km 이탈 위치로 설정
        </Button>
      </div>

      {/* 알림 모달 */}
      <ConfirmModal
        isOpen={modalOpen}
        messages={modalMessages}
        onConfirm={closeModal}
        onClose={closeModal}
      />
    </div>
  );
};
export default Admin;
