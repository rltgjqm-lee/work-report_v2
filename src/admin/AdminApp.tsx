import { Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminLayout from "./components/AdminLayout";
import OrganizationsPage from "./pages/OrganizationsPage";
import ProgramsPage from "./pages/ProgramsPage";
import ProgramDetailPage from "./pages/ProgramDetailPage";
import AttendancePage from "./pages/AttendancePage";
import LeaveStatsPage from "./pages/LeaveStatsPage";
import EscapesPage from "./pages/EscapesPage";
import ParticipantsPage from "./pages/ParticipantsPage";
import DisasterMessagesPage from "./pages/DisasterMessagesPage";
import DisasterPushLogsPage from "./pages/DisasterPushLogsPage";
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
          <Route path="programs/:id/leaves" element={<LeaveStatsPage />} />
          <Route path="programs/:id/escapes" element={<EscapesPage />} />
          <Route path="escapes" element={<EscapesPage />} />
          <Route path="participants" element={<ParticipantsPage />} />
          <Route path="safety-alerts" element={<DisasterMessagesPage />} />
          <Route path="disaster-push-logs" element={<DisasterPushLogsPage />} />
          <Route path="admins" element={<AdminsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  </AuthProvider>
);

export default AdminApp;
