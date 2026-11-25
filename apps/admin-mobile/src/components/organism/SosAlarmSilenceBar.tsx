import { useEffect, useState } from "react";

import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { VolumeX } from "lucide-react";

import { useSession } from "../../context/useSession";

import { isSosAlarmRinging, listenToSosAlarmRinging, silenceSosAlarm } from "../../lib/sosAlarm";

// SOS 알람이 울리는 동안 화면 맨 위에 띄우는 "알람 끄기" 막대. 풀스크린으로 앱이 떠도 잠금
// 화면(지문/PIN)부터 나오므로 잠금을 풀기 전에도 바로 끌 수 있게 로그인·잠금 화면 위에도 띄운다.
const SosAlarmSilenceBar = () => {
  const { status, incomingSos } = useSession();
  const [isRinging, setIsRinging] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const refreshRinging = () => {
      isSosAlarmRinging().then(setIsRinging);
    };
    refreshRinging();
    const removeRingingListener = listenToSosAlarmRinging(setIsRinging);
    const resumeHandlePromise = CapacitorApp.addListener("resume", refreshRinging);
    return () => {
      removeRingingListener();
      resumeHandlePromise.then((handle) => handle.remove());
    };
  }, []);

  // 앱 안 SOS 화면(SosAlertScreen)이 떠 있으면 그 화면의 버튼으로 끈다
  if (!isRinging || (status === "unlocked" && incomingSos)) return null;

  const handleSilenceButtonClick = async () => {
    await silenceSosAlarm();
    setIsRinging(false);
  };

  return (
    <button
      type="button"
      onClick={handleSilenceButtonClick}
      className="fixed inset-x-3 top-3 z-[60] flex h-14 items-center justify-center gap-2.5 rounded-2xl bg-sos text-[17px] font-extrabold text-white shadow-[0_8px_24px_rgba(185,28,28,.35)]"
    >
      <VolumeX size={22} aria-hidden="true" />
      SOS 알람 끄기
    </button>
  );
};

export default SosAlarmSilenceBar;
