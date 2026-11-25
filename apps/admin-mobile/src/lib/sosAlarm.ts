import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

// 네이티브 로컬 플러그인(android/.../SosAlarmPlugin.java) — SOS 알람(항상 풀스크린) 방식과 끄기
export type SosAlertMode = "sound" | "vibrate";

type SosAlarmSettings = {
  alertMode: SosAlertMode;
  // Android 14+는 사용자가 휴대폰 설정에서 "풀스크린 알림"을 허용해야 실제로 뜬다
  fullScreenPermitted: boolean;
};

type SosAlarmPlugin = {
  getSettings: () => Promise<SosAlarmSettings>;
  setAlertMode: (options: { mode: SosAlertMode }) => Promise<void>;
  isRinging: () => Promise<{ isRinging: boolean }>;
  silence: () => Promise<void>;
  openFullScreenSettings: () => Promise<void>;
  addListener: (
    eventName: "ringingChange",
    listener: (event: { isRinging: boolean }) => void,
  ) => Promise<PluginListenerHandle>;
};

const SosAlarm = registerPlugin<SosAlarmPlugin>("SosAlarm");

export const getSosAlarmSettings = async (): Promise<SosAlarmSettings | null> => {
  if (!Capacitor.isNativePlatform()) return null;
  return SosAlarm.getSettings();
};

export const setSosAlertMode = (mode: SosAlertMode) => SosAlarm.setAlertMode({ mode });

export const openSosFullScreenSettings = () => SosAlarm.openFullScreenSettings();

// SOS 알람이 지금 울리고 있는지(끄기를 누를 때까지 소리·진동을 반복한다)
export const isSosAlarmRinging = async () => {
  if (!Capacitor.isNativePlatform()) return false;
  const { isRinging } = await SosAlarm.isRinging();
  return isRinging;
};

export const silenceSosAlarm = async () => {
  if (!Capacitor.isNativePlatform()) return;
  await SosAlarm.silence();
};

export const listenToSosAlarmRinging = (listener: (isRinging: boolean) => void) => {
  if (!Capacitor.isNativePlatform()) return () => {};
  const handlePromise = SosAlarm.addListener("ringingChange", (event) => listener(event.isRinging));
  return () => {
    handlePromise.then((handle) => handle.remove());
  };
};
