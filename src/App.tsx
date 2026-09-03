import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import MobileApp from "./MobileApp";

const AdminApp = lazy(() => import("./admin/AdminApp"));

function WebLandingPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-2 text-center text-gray-500">
      <p className="text-lg font-medium">앱에서 이용해주세요</p>
      <p className="text-sm">워크 세이프는 모바일 앱 전용 서비스입니다.</p>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={<div className="p-6 text-center text-sm text-gray-400">불러오는 중...</div>}
      >
        <Routes>
          <Route path="/admin/*" element={<AdminApp />} />
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
