import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { App as CapacitorApp } from "@capacitor/app";

import { getMe } from "@work-report/admin-core/api/me";
import { mobileHomeQueryOptions, mobileKeys } from "@work-report/admin-core/api/mobile";
import { setOnUnauthorized } from "@work-report/admin-core/client";

import {
  forgetAccessToken,
  getAccessToken,
  loginWithPassword,
  logoutFromServer,
  refreshAccessToken,
} from "../lib/appAuth";
import { checkPin, hasPin, savePin } from "../lib/appLock";
import {
  getCurrentFcmToken,
  listenToPushNotifications,
  registerForPushNotifications,
  type PushPermission,
  type SosPushData,
} from "../lib/pushNotifications";
import { secureStore, type StoredProfile } from "../lib/secureStore";
import {
  SessionContext,
  type SessionContextValue,
  type SessionStatus,
} from "./sessionContextInstance";

// 앱을 백그라운드에 이만큼 넘게 두었다 돌아오면 다시 잠근다 — 전화 한 통 받고 돌아오는
// 정도로는 잠기지 않게 한다.
const RELOCK_AFTER_MS = 60 * 1000;

const sosPathOf = (data: SosPushData) =>
  data.type === "sos" && data.sosEventId ? `/sos?id=${data.sosEventId}` : null;

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<SessionStatus>("loading");
  const [profile, setProfile] = useState<StoredProfile | null>(null);
  const [isLockEnabled, setIsLockEnabled] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [signOutMessage, setSignOutMessage] = useState<string | null>(null);
  const [pushPermission, setPushPermission] = useState<PushPermission | null>(null);
  const [incomingSos, setIncomingSos] = useState<SosPushData | null>(null);

  // 앱 상태·알림 리스너(한 번만 붙임) 안에서 지금 상태를 읽기 위한 사본
  const statusRef = useRef(status);
  const isLockEnabledRef = useRef(isLockEnabled);
  useEffect(() => {
    statusRef.current = status;
    isLockEnabledRef.current = isLockEnabled;
  }, [status, isLockEnabled]);
  // 알림을 눌러 열었는데 아직 잠겨 있으면, 잠금을 푼 뒤 갈 화면
  const pendingPathRef = useRef<string | null>(null);
  const hasRegisteredPushRef = useRef(false);

  const signOutLocally = useCallback(
    async (message: string | null) => {
      forgetAccessToken();
      await secureStore.clear();
      queryClient.clear();
      hasRegisteredPushRef.current = false;
      setProfile(null);
      setIsLockEnabled(false);
      setSignOutMessage(message);
      setStatus("signedOut");
    },
    [queryClient],
  );

  // 잠금을 푼 뒤 — 접속 토큰이 없으면(앱을 새로 켰거나 1시간이 지남) 갱신 토큰으로 받는다.
  const finishUnlock = useCallback(async () => {
    setUnlockError(null);
    try {
      if (!getAccessToken() && !(await refreshAccessToken())) {
        await signOutLocally("로그인이 만료되었어요. 다시 로그인해주세요.");
        return;
      }
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : "서버에 연결할 수 없습니다.");
      setStatus("locked");
      return;
    }

    setStatus("unlocked");
    if (!hasRegisteredPushRef.current) {
      hasRegisteredPushRef.current = true;
      registerForPushNotifications()
        .then(setPushPermission)
        .catch((error) => console.error("알림 등록 실패:", error));
    }
    if (pendingPathRef.current) {
      navigate(pendingPathRef.current);
      pendingPathRef.current = null;
    }
  }, [navigate, signOutLocally]);

  useEffect(() => {
    const restoreSession = async () => {
      const refreshToken = await secureStore.getRefreshToken();
      if (!refreshToken) {
        setStatus("signedOut");
        return;
      }
      setProfile(await secureStore.getProfile());
      const lockEnabled = await hasPin();
      setIsLockEnabled(lockEnabled);
      if (lockEnabled) {
        setStatus("locked");
        return;
      }
      await finishUnlock();
    };
    restoreSession();
    // 앱을 켤 때 한 번만 확인한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 접속 토큰도 갱신 토큰도 안 통하면(비밀번호 변경·계정 비활성화 등) 로그인 화면으로 보낸다
  useEffect(() => {
    setOnUnauthorized(() => {
      if (statusRef.current === "signedOut") return;
      signOutLocally("로그인이 만료되었어요. 다시 로그인해주세요.");
    });
  }, [signOutLocally]);

  useEffect(() => {
    let backgroundedAt = 0;
    const handlePromise = CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) {
        backgroundedAt = Date.now();
        return;
      }
      if (
        statusRef.current === "unlocked" &&
        isLockEnabledRef.current &&
        backgroundedAt > 0 &&
        Date.now() - backgroundedAt > RELOCK_AFTER_MS
      ) {
        setStatus("locked");
      }
    });
    return () => {
      handlePromise.then((handle) => handle.remove());
    };
  }, []);

  useEffect(() => {
    const removePromise = listenToPushNotifications({
      onReceived: (data) => {
        queryClient.invalidateQueries({ queryKey: mobileKeys.all });
        if (data.type === "sos") setIncomingSos(data);
      },
      onOpened: (data) => {
        queryClient.invalidateQueries({ queryKey: mobileKeys.all });
        const path = sosPathOf(data);
        if (!path) return;
        if (statusRef.current === "unlocked") navigate(path);
        else pendingPathRef.current = path;
      },
    });
    return () => {
      removePromise.then((remove) => remove());
    };
  }, [navigate, queryClient]);

  const login = useCallback(
    async (email: string, password: string) => {
      await loginWithPassword(email, password);
      const [me, home] = await Promise.all([
        getMe(),
        queryClient.fetchQuery(mobileHomeQueryOptions),
      ]);
      const nextProfile: StoredProfile = {
        name: me.name,
        email: me.email,
        role: me.role,
        organizationName: home.organizationName,
      };
      await secureStore.setProfile(nextProfile);
      setProfile(nextProfile);
      setSignOutMessage(null);
      setStatus("needsPin");
    },
    [queryClient],
  );

  const completePinSetup = useCallback(
    async (pin: string) => {
      await savePin(pin);
      setIsLockEnabled(true);
      if (statusRef.current === "needsPin") await finishUnlock();
    },
    [finishUnlock],
  );

  const unlockWithPin = useCallback(
    async (pin: string) => {
      const result = await checkPin(pin);
      if (result.status === "ok") {
        await finishUnlock();
        return { ok: true };
      }
      if (result.status === "tooManyFailures") {
        await logoutFromServer(getCurrentFcmToken());
        await signOutLocally("PIN을 5번 틀려서 로그아웃했어요. 다시 로그인해주세요.");
        return { ok: false };
      }
      return {
        ok: false,
        message: `PIN이 맞지 않아요. ${result.remaining}번 더 틀리면 로그아웃돼요.`,
      };
    },
    [finishUnlock, signOutLocally],
  );

  const logout = useCallback(async () => {
    await logoutFromServer(getCurrentFcmToken());
    await signOutLocally(null);
  }, [signOutLocally]);

  const disableLock = useCallback(async () => {
    await secureStore.removePin();
    setIsLockEnabled(false);
  }, []);

  const value: SessionContextValue = {
    status,
    profile,
    isLockEnabled,
    unlockError,
    signOutMessage,
    pushPermission,
    incomingSos,
    login,
    completePinSetup,
    unlockWithPin,
    unlockWithBiometry: finishUnlock,
    retryUnlock: finishUnlock,
    logout,
    disableLock,
    refreshPushPermission: setPushPermission,
    dismissIncomingSos: () => setIncomingSos(null),
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};
