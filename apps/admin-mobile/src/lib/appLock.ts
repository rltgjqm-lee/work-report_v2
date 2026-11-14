import {
  AndroidBiometryStrength,
  BiometricAuth,
  BiometryError,
  BiometryErrorType,
} from "@aparajita/capacitor-biometric-auth";
import { Capacitor } from "@capacitor/core";

import { secureStore } from "./secureStore";

// 앱 잠금 — 앱을 다시 열 때 지문(또는 PIN)으로 풀어야 갱신 토큰을 꺼내 쓴다.
// PIN은 원문 대신 무작위 salt를 붙인 SHA-256 해시만 Keystore에 둔다.

export const PIN_LENGTH = 6;
export const MAX_PIN_FAILURES = 5;

const toHex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const hashPin = async (salt: string, pin: string) =>
  toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${pin}`)));

export const hasPin = async () => (await secureStore.getPin()) !== null;

export const savePin = async (pin: string) => {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  await secureStore.setPin({ salt, hash: await hashPin(salt, pin) });
  await secureStore.setPinFailures(0);
};

export type PinCheckResult =
  { status: "ok" } | { status: "wrong"; remaining: number } | { status: "tooManyFailures" };

// 틀린 횟수는 앱을 껐다 켜도 이어진다 — 다섯 번 틀리면 로그아웃시킨다.
export const checkPin = async (pin: string): Promise<PinCheckResult> => {
  const stored = await secureStore.getPin();
  if (!stored) return { status: "tooManyFailures" };

  if ((await hashPin(stored.salt, pin)) === stored.hash) {
    await secureStore.setPinFailures(0);
    return { status: "ok" };
  }

  const failures = (await secureStore.getPinFailures()) + 1;
  await secureStore.setPinFailures(failures);
  if (failures >= MAX_PIN_FAILURES) return { status: "tooManyFailures" };
  return { status: "wrong", remaining: MAX_PIN_FAILURES - failures };
};

export const isBiometryAvailable = async () => {
  if (!Capacitor.isNativePlatform()) return false;
  const result = await BiometricAuth.checkBiometry();
  return result.isAvailable;
};

export type BiometryResult = "ok" | "cancelled" | "failed";

export const authenticateWithBiometry = async (): Promise<BiometryResult> => {
  try {
    await BiometricAuth.authenticate({
      reason: "관리자 앱 잠금 해제",
      cancelTitle: "PIN으로 입력",
      androidTitle: "관리자 앱 잠금 해제",
      androidSubtitle: "등록한 지문으로 잠금을 풀어요",
      androidConfirmationRequired: false,
      androidBiometryStrength: AndroidBiometryStrength.weak,
    });
    return "ok";
  } catch (error) {
    if (
      error instanceof BiometryError &&
      (error.code === BiometryErrorType.userCancel ||
        error.code === BiometryErrorType.appCancel ||
        error.code === BiometryErrorType.systemCancel)
    ) {
      return "cancelled";
    }
    return "failed";
  }
};
