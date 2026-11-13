import { Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";

import MobileApp from "./MobileApp";

function WebLandingPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-2 text-center text-gray-500">
      <p className="text-lg font-medium">앱에서 이용해주세요</p>
      <p className="text-sm">워크 세이프는 모바일 앱 전용 서비스입니다.</p>
    </div>
  );
}

// 관리자 콘솔은 admin.worksafe.co.kr로 옮겼다 — 예전 주소(/admin/...)로 들어오면 /admin을 뗀
// 같은 화면으로 보낸다. 서버 단(_redirects)이 아니라 여기서 보내는 이유: 이 주소에서 예전에
// 등록한 관리자 알림(/admin/ 스코프 서비스워커)이 살아 있으면 새 주소에서 받는 알림과 함께
// 두 번 울린다.
// 구독을 해지해두면 푸시 서버가 410을 돌려줘 Worker가 그 구독을 DB에서 지운다.
function AdminMovedRedirect() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    const target = `${import.meta.env.VITE_ADMIN_WEB_URL}${pathname.replace(/^\/admin/, "")}${search}`;

    const removeOldAdminPush = async () => {
      if (!("serviceWorker" in navigator)) return;
      const registration = await navigator.serviceWorker.getRegistration("/admin/");
      if (!registration) return;
      const subscription = await registration.pushManager.getSubscription();
      await subscription?.unsubscribe();
      await registration.unregister();
    };

    removeOldAdminPush()
      .catch((error) => console.error("예전 관리자 알림 정리 실패:", error))
      .finally(() => window.location.replace(target));
  }, [pathname, search]);

  return <div className="p-6 text-center text-sm text-gray-400">관리자 페이지로 이동 중...</div>;
}

function App() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={<div className="p-6 text-center text-sm text-gray-400">불러오는 중...</div>}
      >
        <Routes>
          <Route path="/admin/*" element={<AdminMovedRedirect />} />
          {/* 개발자가 실서버 사용자 앱을 웹 브라우저에서 확인하기 위한 비공개 경로 —
              어디에도 링크되지 않는다. */}
          <Route path="/preview" element={<MobileApp />} />
          <Route path="*" element={<WebLandingPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
