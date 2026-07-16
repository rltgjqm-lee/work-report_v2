import { Outlet } from "react-router-dom";

import { useAuth } from "../context/useAuth";

const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full min-h-screen bg-[#f3f4f6] text-sm text-[#6b7280]">
        확인 중...
      </div>
    );
  }

  // Cloudflare Access가 이 경로 전체를 보호하고 있으므로, 여기까지 왔다는 건
  // 이메일 OTP 인증은 통과했다는 뜻이다. isAuthenticated=false는
  // "인증된 이메일이 admins 테이블에 등록되지 않음"을 의미한다.
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center w-full min-h-screen bg-[#f3f4f6]">
        <div className="w-[360px] bg-white border border-[#e2e5eb] rounded-[10px] p-8 text-center">
          <div className="text-[15px] font-bold text-[#14283d] mb-2">
            접근 권한이 없습니다
          </div>
          <p className="text-[13px] text-[#6b7280]">
            이 계정은 관리자로 등록되어 있지 않습니다. 시스템 담당자에게
            문의해주세요.
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;
