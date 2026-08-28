import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import AdminLayout from "./components/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";

const AdminsPage = lazy(() => import("./pages/admins/AdminsPage"));
const AttendancePage = lazy(() => import("./pages/attendance/AttendancePage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const DisasterMessagesPage = lazy(() => import("./pages/DisasterMessagesTestPage"));
const DisasterPushLogsPage = lazy(() => import("./pages/DisasterPushLogsPage"));
const EscapesPage = lazy(() => import("./pages/EscapesPage"));
const LoginHistoryPage = lazy(() => import("./pages/LoginHistoryPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const OrganizationsPage = lazy(() => import("./pages/organizations/OrganizationsPage"));
const ParticipantDetailPage = lazy(
  () => import("./pages/participant_detail/ParticipantDetailPage"),
);
const ParticipantsPage = lazy(() => import("./pages/ParticipantsPage"));
const ProgramDetailPage = lazy(() => import("./pages/program_detail/ProgramDetailPage"));
const ProgramsPage = lazy(() => import("./pages/programs/ProgramsPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));

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
        <Suspense
          fallback={<div className="p-6 text-center text-sm text-gray-400">불러오는 중...</div>}
        >
          <Routes>
            <Route path="login" element={<LoginPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
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
        </Suspense>
      </AuthProvider>
    </ToastProvider>
  </QueryClientProvider>
);

export default AdminApp;
