import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import AdminApp from "./AdminApp";

// 참여자 앱에 같이 있던 시절과 이 도메인으로 처음 옮긴 날(2026-11-13)에는 주소가 /admin/... 이었다.
// 그때 보낸 알림·비밀번호 재설정 메일·즐겨찾기가 그 주소를 가리키므로 /admin을 떼고 보낸다.
function LegacyAdminPathRedirect() {
  const { pathname, search } = useLocation();
  const nextPath = pathname.replace(/^\/admin/, "") || "/";
  return <Navigate to={`${nextPath}${search}`} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/*" element={<LegacyAdminPathRedirect />} />
        <Route path="/*" element={<AdminApp />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
