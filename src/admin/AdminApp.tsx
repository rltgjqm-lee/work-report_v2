import { Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminLayout from "./components/AdminLayout";
import OrganizationsPage from "./pages/OrganizationsPage";
import ProgramsPage from "./pages/ProgramsPage";
import ProgramDetailPage from "./pages/ProgramDetailPage";
import AttendancePage from "./pages/AttendancePage";
import ParticipantsPage from "./pages/ParticipantsPage";
import SafetyAlertsPage from "./pages/SafetyAlertsPage";
import AdminsPage from "./pages/AdminsPage";

const AdminApp = () => (
  <AuthProvider>
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route
            index
            element={<Navigate to="/admin/organizations" replace />}
          />
          <Route path="organizations" element={<OrganizationsPage />} />
          <Route path="programs" element={<ProgramsPage />} />
          <Route path="programs/:id" element={<ProgramDetailPage />} />
          <Route path="programs/:id/attendance" element={<AttendancePage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="participants" element={<ParticipantsPage />} />
          <Route path="safety-alerts" element={<SafetyAlertsPage />} />
          <Route path="admins" element={<AdminsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  </AuthProvider>
);

export default AdminApp;
