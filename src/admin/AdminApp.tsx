import { Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import AdminLayout from "./components/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import AdminsPage from "./pages/admins/AdminsPage";
import AttendancePage from "./pages/attendance/AttendancePage";
import ContactPage from "./pages/ContactPage";
import DisasterMessagesPage from "./pages/DisasterMessagesTestPage";
import DisasterPushLogsPage from "./pages/DisasterPushLogsPage";
import EscapesPage from "./pages/EscapesPage";
import LoginHistoryPage from "./pages/LoginHistoryPage";
import LoginPage from "./pages/LoginPage";
import OrganizationsPage from "./pages/organizations/OrganizationsPage";
import ParticipantDetailPage from "./pages/participant_detail/ParticipantDetailPage";
import ParticipantsPage from "./pages/ParticipantsPage";
import ProgramDetailPage from "./pages/program_detail/ProgramDetailPage";
import ProgramsPage from "./pages/programs/ProgramsPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
  },
});

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
              <Route path="program" element={<ProgramDetailPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="escapes" element={<EscapesPage />} />
              <Route path="participants" element={<ParticipantsPage />} />
              <Route path="participant" element={<ParticipantDetailPage />} />
              <Route path="safety-alerts" element={<DisasterMessagesPage />} />
              <Route path="disaster-push-logs" element={<DisasterPushLogsPage />} />
              <Route path="admins" element={<AdminsPage />} />
              <Route path="login-history" element={<LoginHistoryPage />} />
              <Route path="contact" element={<ContactPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  </QueryClientProvider>
);

export default AdminApp;
