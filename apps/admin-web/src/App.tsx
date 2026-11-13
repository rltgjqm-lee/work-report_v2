import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import AdminApp from "./AdminApp";

// 주소는 참여자 앱에 같이 있던 시절의 /admin/... 을 그대로 쓴다 — 서버가 보내는 알림
// 링크(/admin/escapes?...)와 비밀번호 재설정 메일 링크가 이 경로를 가리키고 있다.
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
