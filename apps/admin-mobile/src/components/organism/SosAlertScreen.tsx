import { CircleAlert } from "lucide-react";

import { useSession } from "../../context/useSession";

import { dismissSosAlarm, silenceSosAlarm } from "../../lib/sosAlarm";

// SOS 화면 — 앱을 보고 있을 때 SOS가 오거나 풀스크린 알림으로 앱이 열리면 화면 전체로 띄운다.
// 잠금 화면(지문/PIN)보다 먼저 뜨고, 두 버튼 모두 울리는 알람을 멈춘다.
const SosAlertScreen = () => {
  const { incomingSos, dismissIncomingSos, openIncomingSos } = useSession();
  if (!incomingSos) return null;

  // 확인하러 가니 알림창의 그 SOS 알림도 지운다. "알람 끄고 닫기"는 나중에 볼 수 있게 남겨둔다.
  const handleConfirmButtonClick = () => {
    if (incomingSos.sosEventId) dismissSosAlarm(Number(incomingSos.sosEventId));
    else silenceSosAlarm();
    openIncomingSos();
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
