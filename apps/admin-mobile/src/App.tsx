import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

import { configureClient } from "@work-report/admin-core/client";

import { useSession } from "./context/useSession";

import SosAlertBanner from "./components/organism/SosAlertBanner";
import TabLayout from "./components/organism/TabLayout";
import { SessionProvider } from "./context/SessionContext";
import { getAccessToken, refreshAccessToken } from "./lib/appAuth";
import EscapeDetailPage from "./pages/EscapeDetailPage";
import HomePage from "./pages/HomePage";
import LockPage from "./pages/LockPage";
import LoginPage from "./pages/LoginPage";
import MyInfoPage from "./pages/MyInfoPage";
import PinSetupPage from "./pages/PinSetupPage";
import SafetyPage from "./pages/SafetyPage";
import SosDetailPage from "./pages/SosDetailPage";
import ZoneDetailPage from "./pages/ZoneDetailPage";
import ZonesPage from "./pages/ZonesPage";

// admin-core의 API 파일들이 쓸 서버 주소와 인증 방식 — 관리자 앱은 쿠키 대신 접속 토큰을 보낸다
configureClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL,
  tokenAuth: { getAccessToken, refreshAccessToken },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
  },
});

// 로그인·잠금 상태에 따라 화면을 통째로 바꾼다. 잠금을 풀어야만 아래 화면(Routes)에 들어간다.
const SessionGate = () => {
  const { status } = useSession();
  const navigate = useNavigate();

  // 휴대폰 뒤로 가기 — 홈(또는 로그인·잠금 화면)에서는 앱을 나가고, 그 밖에서는 이전 화면으로.
  // 알림을 눌러 바로 들어와 돌아갈 화면이 없으면 홈으로 보낸다.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handlePromise = CapacitorApp.addListener("backButton", () => {
      if (status !== "unlocked" || window.location.pathname === "/") {
        CapacitorApp.exitApp();
        return;
      }
      if (window.history.state?.idx > 0) navigate(-1);
      else navigate("/", { replace: true });
    });
    return () => {
      handlePromise.then((handle) => handle.remove());
    };
  }, [status, navigate]);

  if (status === "loading") return <div className="h-full bg-accent" />;
  if (status === "signedOut") return <LoginPage />;
  if (status === "needsPin") return <PinSetupPage mode="initial" />;
  if (status === "locked") return <LockPage />;

  return (
    <>
      <SosAlertBanner />
      <Routes>
        <Route element={<TabLayout />}>
          <Route index element={<HomePage />} />
          <Route path="safety" element={<SafetyPage />} />
          <Route path="zones" element={<ZonesPage />} />
          <Route path="me" element={<MyInfoPage />} />
        </Route>
        <Route path="sos" element={<SosDetailPage />} />
        <Route path="escape" element={<EscapeDetailPage />} />
        <Route path="zone" element={<ZoneDetailPage />} />
        <Route path="pin" element={<PinSetupPage mode="change" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

const App = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    // 상태바를 헤더와 같은 남색으로 맞추고 글자는 흰색으로
    StatusBar.setBackgroundColor({ color: "#1e3a5f" }).catch(() => {});
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionProvider>
          <SessionGate />
        </SessionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
