import { createContext } from "react";

import type { PushPermission, SosPushData } from "../lib/pushNotifications";
import type { StoredProfile } from "../lib/secureStore";

// loading: 저장된 로그인 확인 중 / signedOut: 로그인 화면 / needsPin: 첫 로그인 후 PIN 만들기
// locked: 앱 잠금 화면 / unlocked: 사용 중
export type SessionStatus = "loading" | "signedOut" | "needsPin" | "locked" | "unlocked";

export type SessionContextValue = {
  status: SessionStatus;
  profile: StoredProfile | null;
  isLockEnabled: boolean;
  unlockError: string | null;
  signOutMessage: string | null;
  pushPermission: PushPermission | null;
  incomingSos: SosPushData | null;
  login: (email: string, password: string) => Promise<void>;
  completePinSetup: (pin: string) => Promise<void>;
  unlockWithPin: (pin: string) => Promise<{ ok: boolean; message?: string }>;
  unlockWithBiometry: () => Promise<void>;
  retryUnlock: () => Promise<void>;
  logout: () => Promise<void>;
  disableLock: () => Promise<void>;
  refreshPushPermission: (permission: PushPermission) => void;
  dismissIncomingSos: () => void;
  // SOS 화면의 "SOS 확인하기" — 잠겨 있으면 잠금을 푼 뒤 그 SOS 상세로 간다
  openIncomingSos: () => void;
};

export const SessionContext = createContext<SessionContextValue | null>(null);
