import { BrowserRouter, Routes, Route } from "react-router-dom";

import MobileApp from "./MobileApp";
import AdminApp from "./admin/AdminApp";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="*" element={<MobileApp />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
