import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../context/useAuth";

const ProtectedRoute = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  return <Outlet />;
};

export default ProtectedRoute;
