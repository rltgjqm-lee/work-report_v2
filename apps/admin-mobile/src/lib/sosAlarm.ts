import { Capacitor, registerPlugin } from "@capacitor/core";

// 네이티브 로컬 플러그인(android/.../SosAlarmPlugin.java) — SOS 풀스크린 알림 설정
type SosAlarmSettings = {
  fullScreenEnabled: boolean;
  // Android 14+는 사용자가 휴대폰 설정에서 "풀스크린 알림"을 허용해야 실제로 뜬다
  fullScreenPermitted: boolean;
};

type SosAlarmPlugin = {
  getSettings: () => Promise<SosAlarmSettings>;
  setFullScreenEnabled: (options: { enabled: boolean }) => Promise<void>;
  openFullScreenSettings: () => Promise<void>;
};

const SosAlarm = registerPlugin<SosAlarmPlugin>("SosAlarm");

export const getSosAlarmSettings = async (): Promise<SosAlarmSettings | null> => {
  if (!Capacitor.isNativePlatform()) return null;
  return SosAlarm.getSettings();
};

export const setSosFullScreenEnabled = (enabled: boolean) =>
  SosAlarm.setFullScreenEnabled({ enabled });

export const openSosFullScreenSettings = () => SosAlarm.openFullScreenSettings();
