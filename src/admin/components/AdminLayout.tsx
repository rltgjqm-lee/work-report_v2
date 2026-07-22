import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { logout } from "../api/auth";
import ChangePasswordModal from "./ChangePasswordModal";
import { useAuth } from "../context/useAuth";
import { ROLES } from "../types";

const BASE_NAV_ITEMS = [
  { to: "/admin/organizations", label: "기관 관리", badge: "1" },
  { to: "/admin/programs", label: "사업단 관리", badge: "2" },
  { to: "/admin/participants", label: "참여자 관리", badge: "3" },
  { to: "/admin/attendance", label: "근태 관리", badge: "4" },
  { to: "/admin/leaves", label: "휴가 현황", badge: "5" },
  { to: "/admin/escapes", label: "이탈 관제", badge: "6" },
  { to: "/admin/disaster-push-logs", label: "재난문자 발송이력", badge: "7" },
];

// 실제 발송 안 된 원본 수신내역까지 다 보이는 진단용 화면이라 SUPER_ADMIN에게만 노출
const SAFETY_ALERT_TEST_NAV_ITEM = {
  to: "/admin/safety-alerts",
  label: "재난문자 테스트",
  badge: "8",
};

const ADMIN_ACCOUNTS_NAV_ITEM = {
  to: "/admin/admins",
  label: "관리자 계정",
  badge: "9",
};

// IP 등 민감정보가 보이는 화면이라 SUPER_ADMIN에게만 노출
const LOGIN_HISTORY_NAV_ITEM = {
  to: "/admin/login-history",
  label: "로그인 이력",
  badge: "10",
};

const getTopbarTitle = (pathname: string) => {
  if (/^\/admin\/programs\/\d+\/attendance/.test(pathname)) return "근태 조회";
  if (/^\/admin\/programs\/\d+\/leaves/.test(pathname)) return "휴가 현황";
  if (/^\/admin\/programs\/\d+\/escapes/.test(pathname)) return "이탈 관제";
  if (/^\/admin\/programs\/\d+/.test(pathname)) return "사업단 상세";
  if (pathname.startsWith("/admin/programs")) return "사업단 관리";
  if (pathname.startsWith("/admin/organizations")) return "기관 관리";
  if (pathname.startsWith("/admin/participants")) return "참여자 관리";
  if (pathname.startsWith("/admin/attendance")) return "근태 관리";
  if (pathname.startsWith("/admin/leaves")) return "휴가 현황";
  if (pathname.startsWith("/admin/escapes")) return "이탈 관제";
  if (pathname.startsWith("/admin/disaster-push-logs"))
    return "재난문자 발송이력";
  if (pathname.startsWith("/admin/safety-alerts")) return "재난문자 테스트";
  if (pathname.startsWith("/admin/admins")) return "관리자 계정";
  if (pathname.startsWith("/admin/login-history")) return "로그인 이력";
  return "관리자 콘솔";
};

/**
 * 관리자 콘솔의 사이드바 + 상단바를 포함한 공통 레이아웃입니다.
 *
 */
const AdminLayout = () => {
  const { admin, refresh } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  const navItems = [
    ...BASE_NAV_ITEMS,
    ...(admin?.role === ROLES.SUPER_ADMIN ? [SAFETY_ALERT_TEST_NAV_ITEM] : []),
    ...(admin?.role === ROLES.SUPER_ADMIN ||
    admin?.role === ROLES.ORGANIZATION_ADMIN
      ? [ADMIN_ACCOUNTS_NAV_ITEM]
      : []),
    ...(admin?.role === ROLES.SUPER_ADMIN ? [LOGIN_HISTORY_NAV_ITEM] : []),
  ];

  const handleLogoutButtonClick = async () => {
    await logout();
    await refresh();
    navigate("/admin/login");
  };

  const todayLabel = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex w-full min-h-screen bg-[#f3f4f6] text-[#1f2937] font-sans">
      <aside className="w-[248px] flex-none bg-[#14283d] text-[#e6ebf2] flex flex-col py-6">
        <div className="px-6 pb-[22px] border-b border-white/[0.08] mb-3.5">
          <div className="text-[15px] font-bold text-white">
            기관 통합관리시스템
          </div>
          <div className="text-[11px] text-[#8fa3bd] mt-[5px]">
            노인일자리 사업 관리
          </div>
        </div>
        {navItems.map((navItem) => (
          <NavLink
            key={navItem.to}
            to={navItem.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-6 py-[13px] text-sm font-medium border-l-[3px] ${
                isActive
                  ? "bg-white/[0.08] text-white border-l-[#1e3a5f]"
                  : "text-[#c3d0e0] border-l-transparent hover:bg-white/5 hover:text-white"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`w-[22px] h-[22px] flex-none rounded-[4px] flex items-center justify-center text-xs font-bold ${
                    isActive ? "bg-[#1e3a5f] text-white" : "bg-white/[0.12]"
                  }`}
                >
                  {navItem.badge}
                </span>
                {navItem.label}
              </>
            )}
          </NavLink>
        ))}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-[60px] flex-none bg-white border-b border-[#e2e5eb] flex items-center justify-between px-8">
          <div className="text-base font-bold">
            {getTopbarTitle(location.pathname)}
          </div>
          <div className="flex items-center gap-4 text-xs text-[#6b7280]">
            <span>
              {todayLabel} · {admin?.name ?? admin?.email}
            </span>
            <button
              onClick={() => setPasswordModalOpen(true)}
              className="text-[#374151] font-semibold cursor-pointer bg-transparent border-none hover:underline"
            >
              비밀번호 변경
            </button>
            <button
              onClick={handleLogoutButtonClick}
              className="text-[#8a6d1f] font-semibold cursor-pointer bg-transparent border-none hover:underline"
            >
              로그아웃
            </button>
          </div>
        </div>

        <div className="flex-1 p-7 px-8 overflow-auto">
          <Outlet />
        </div>
      </div>

      {passwordModalOpen && (
        <ChangePasswordModal onClose={() => setPasswordModalOpen(false)} />
      )}
    </div>
  );
};

export default AdminLayout;
