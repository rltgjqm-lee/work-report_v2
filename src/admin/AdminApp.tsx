import { Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminLayout from "./components/AdminLayout";
import LoginPage from "./pages/LoginPage";
import OrganizationsPage from "./pages/organizations/OrganizationsPage";
import ProgramsPage from "./pages/programs/ProgramsPage";
import ProgramDetailPage from "./pages/program_detail/ProgramDetailPage";
import AttendancePage from "./pages/attendance/AttendancePage";
import EscapesPage from "./pages/EscapesPage";
import ParticipantsPage from "./pages/ParticipantsPage";
import ParticipantDetailPage from "./pages/participant_detail/ParticipantDetailPage";
import DisasterMessagesPage from "./pages/DisasterMessagesTestPage";
import DisasterPushLogsPage from "./pages/DisasterPushLogsPage";
import AdminsPage from "./pages/admins/AdminsPage";
import LoginHistoryPage from "./pages/LoginHistoryPage";

const queryClient = new QueryClient();

const AdminApp = () => (
  <QueryClientProvider client={queryClient}>
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/organizations" replace />} />
              <Route path="organizations" element={<OrganizationsPage />} />
              <Route path="programs" element={<ProgramsPage />} />
              <Route path="programs/:id" element={<ProgramDetailPage />} />
              <Route path="programs/:id/attendance" element={<AttendancePage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="programs/:id/escapes" element={<EscapesPage />} />
              <Route path="escapes" element={<EscapesPage />} />
              <Route path="participants" element={<ParticipantsPage />} />
              <Route path="participants/:id" element={<ParticipantDetailPage />} />
              <Route path="safety-alerts" element={<DisasterMessagesPage />} />
              <Route path="disaster-push-logs" element={<DisasterPushLogsPage />} />
              <Route path="admins" element={<AdminsPage />} />
              <Route path="login-history" element={<LoginHistoryPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  </QueryClientProvider>
);

export default AdminApp;
