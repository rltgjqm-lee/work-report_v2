import { SecureStorage } from "@aparajita/capacitor-secure-storage";

// 폰의 Android Keystore로 암호화해 저장하는 값들 — 갱신 토큰(30일)과 앱 잠금 PIN 해시.
// 앱 잠금을 풀기 전에는 갱신 토큰을 꺼내 쓰지 않는다(SessionContext가 순서를 지킨다).
// 브라우저(npm run dev)에서는 플러그인이 localStorage로 대신 저장한다.

export type StoredProfile = {
  name: string | null;
  email: string;
  role: string;
  organizationName: string | null;
};

type StoredPin = {
  salt: string;
  hash: string;
};

const KEYS = {
  refreshToken: "refreshToken",
  profile: "profile",
  pin: "pin",
  pinFailures: "pinFailures",
} as const;

const getString = async (key: string) => {
  const value = await SecureStorage.get(key);
  return typeof value === "string" ? value : null;
};

export const secureStore = {
  getRefreshToken: () => getString(KEYS.refreshToken),
  setRefreshToken: (refreshToken: string) => SecureStorage.set(KEYS.refreshToken, refreshToken),

  getProfile: async () => {
    const value = await SecureStorage.get(KEYS.profile);
    return value && typeof value === "object" ? (value as StoredProfile) : null;
  },
  setProfile: (profile: StoredProfile) => SecureStorage.set(KEYS.profile, profile),

  getPin: async () => {
    const value = await SecureStorage.get(KEYS.pin);
    return value && typeof value === "object" ? (value as StoredPin) : null;
  },
  setPin: (pin: StoredPin) => SecureStorage.set(KEYS.pin, pin),
  removePin: () => SecureStorage.remove(KEYS.pin),

  getPinFailures: async () => {
    const value = await SecureStorage.get(KEYS.pinFailures);
    return typeof value === "number" ? value : 0;
  },
  setPinFailures: (count: number) => SecureStorage.set(KEYS.pinFailures, count),

  // 로그아웃 — 이 폰에 남은 로그인 흔적을 전부 지운다
  clear: () => SecureStorage.clear(),
};
