import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import MobileApp from "./MobileApp";

const AdminApp = lazy(() => import("./admin/AdminApp"));

function App() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={<div className="p-6 text-center text-sm text-gray-400">불러오는 중...</div>}
      >
        <Routes>
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="*" element={<MobileApp />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
