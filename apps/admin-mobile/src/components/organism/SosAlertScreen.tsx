import { useNavigate } from "react-router-dom";

import { CircleAlert } from "lucide-react";

import { useSession } from "../../context/useSession";

import { silenceSosAlarm } from "../../lib/sosAlarm";

// 앱을 보고 있을 때 SOS가 오면 화면 전체로 띄운다 — 소리·진동은 네이티브(SosAlarm.startInApp)가
// 같이 내고, 두 버튼 모두 그 알람을 멈춘다.
const SosAlertScreen = () => {
  const navigate = useNavigate();
  const { incomingSos, dismissIncomingSos } = useSession();
  if (!incomingSos) return null;

  const handleConfirmButtonClick = () => {
    silenceSosAlarm();
    dismissIncomingSos();
    navigate(incomingSos.sosEventId ? `/sos?id=${incomingSos.sosEventId}` : "/safety");
  };

  const handleCloseButtonClick = () => {
    silenceSosAlarm();
    dismissIncomingSos();
  };

  return (
    <div
      role="alertdialog"
      aria-label="SOS 요청"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-sos px-6 text-white"
    >
      <span className="flex h-28 w-28 animate-pulse items-center justify-center rounded-full bg-white/20">
        <CircleAlert size={64} aria-hidden="true" />
      </span>
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="text-[44px] leading-none font-black">SOS</span>
        <span className="text-[26px] font-extrabold break-all">
          {incomingSos.participantName ?? "참여자"} 님이
          <br />
          SOS를 눌렀어요
        </span>
      </div>
      <div className="flex w-full flex-col gap-3">
        <button
          type="button"
          onClick={handleConfirmButtonClick}
          className="h-16 rounded-[20px] bg-white text-[19px] font-extrabold text-sos-deep"
        >
          SOS 확인하기
        </button>
        <button
          type="button"
          onClick={handleCloseButtonClick}
          className="h-14 rounded-[20px] bg-white/20 text-[17px] font-extrabold text-white"
        >
          알람 끄고 닫기
        </button>
      </div>
    </div>
  );
};

export default SosAlertScreen;
