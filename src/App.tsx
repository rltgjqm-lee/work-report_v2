import { BrowserRouter, Route, Routes } from "react-router-dom";

import AdminApp from "./admin/AdminApp";
import MobileApp from "./MobileApp";

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
