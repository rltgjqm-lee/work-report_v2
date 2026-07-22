import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../context/useAuth";

/**
 * 세션 쿠키 인증 여부를 확인해 관리자 라우트를 보호하는 컴포넌트입니다.
 *
 */
const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full min-h-screen bg-[#f3f4f6] text-sm text-[#6b7280]">
        확인 중...
      </div>
    );
  }

  // 세션이 없거나(로그인 안 함) 만료/비활성 계정이면 로그인 페이지로 보낸다.
  // "이 계정은 등록 안 됨" 같은 세부 사유는 로그인 시도 자체에서 에러 메시지로 드러난다.
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
