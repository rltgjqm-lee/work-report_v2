import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../context/useAuth";

import { organizationQueryOptions } from "../api/admin/organizations";
import { logout } from "../api/auth";
import { ROLES } from "../types/admins";
import { subscribeAdminToPush } from "../utils/adminPushSubscription";
import ChangePasswordModal from "./modal/ChangePasswordModal";
import SessionExpiryBanner from "./SessionExpiryBanner";

const BASE_NAV_ITEMS = [
  { to: "/admin/organizations", label: "기관 관리", badge: "1" },
  { to: "/admin/programs", label: "사업단 관리", badge: "2" },
  { to: "/admin/participants", label: "참여자 관리", badge: "3" },
  { to: "/admin/attendance", label: "근무 관리", badge: "4" },
  { to: "/admin/escapes", label: "안전 관제", badge: "5" },
  { to: "/admin/disaster-push-logs", label: "재난문자 발송이력", badge: "6" },
];

// SUPER_ADMIN에게만 노출
const SAFETY_ALERT_TEST_NAV_ITEM = {
  to: "/admin/safety-alerts",
  label: "재난문자 테스트",
  badge: "7",
};

const ADMIN_ACCOUNTS_NAV_ITEM = {
  to: "/admin/admins",
  label: "관리자 계정",
  badge: "8",
};

const CONTACT_NAV_ITEM = {
  to: "/admin/contact",
  label: "문의하기",
  badge: "9",
};

// SUPER_ADMIN에게만 노출
const LOGIN_HISTORY_NAV_ITEM = {
  to: "/admin/login-history",
  label: "로그인 이력",
  badge: "10",
};

const getTopbarTitle = (pathname: string) => {
  if (pathname === "/admin/program") return "사업단 관리 > 사업단 상세";
  if (pathname.startsWith("/admin/programs")) return "사업단 관리";
  if (pathname.startsWith("/admin/organizations")) return "기관 관리";
  if (pathname === "/admin/participant") return "참여자 관리 > 참여자 상세";
  if (pathname.startsWith("/admin/participants")) return "참여자 관리";
  if (pathname.startsWith("/admin/attendance")) return "근무 관리";
  if (pathname.startsWith("/admin/escapes")) return "안전 관제";
  if (pathname.startsWith("/admin/disaster-push-logs")) return "재난문자 발송이력";
  if (pathname.startsWith("/admin/safety-alerts")) return "재난문자 테스트";
  if (pathname.startsWith("/admin/admins")) return "관리자 계정";
  if (pathname.startsWith("/admin/login-history")) return "로그인 이력";
  if (pathname.startsWith("/admin/contact")) return "문의하기";
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

  const { data: organization } = useQuery({
    ...organizationQueryOptions(admin?.organizationId ?? 0),
    enabled: !!admin?.organizationId,
  });
  const sidebarSubtitle = organization?.name ?? "일자리 사업 관리";

  const navItems = [
    ...BASE_NAV_ITEMS,
    ...(admin?.role === ROLES.SUPER_ADMIN ? [SAFETY_ALERT_TEST_NAV_ITEM] : []),
    ...(admin?.role === ROLES.SUPER_ADMIN || admin?.role === ROLES.ORGANIZATION_ADMIN
      ? [ADMIN_ACCOUNTS_NAV_ITEM]
      : []),
    CONTACT_NAV_ITEM,
    ...(admin?.role === ROLES.SUPER_ADMIN ? [LOGIN_HISTORY_NAV_ITEM] : []),
  ];

  const handleLogoutButtonClick = async () => {
    await logout();
    await refresh();
    navigate("/admin/login");
  };

  // 세션 만료까지 남은 시간을 1초마다 갱신해 보여준다.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // SOS 등 긴급 알림을 관리자 웹 푸시로 받기 위한 구독 — 로그인된 관리자가 확정될 때
  // (재로그인/세션 갱신으로 admin.id가 바뀔 때) 한 번씩 시도한다.
  useEffect(() => {
    if (!admin) return;
    subscribeAdminToPush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin?.id]);

  const sessionRemainingLabel = (() => {
    if (!admin) return "";
    const remainingSeconds = Math.max(
      0,
      Math.floor((new Date(admin.expiresAt).getTime() - now) / 1000),
    );
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `세션 만료까지 ${minutes}:${String(seconds).padStart(2, "0")}`;
  })();

  return (
    <div className="flex w-full min-h-screen bg-surface-page text-text-strong font-sans">
      <aside className="w-[248px] flex-none bg-admin-navy-strong text-admin-sidebar-text flex flex-col py-6">
        <div className="px-6 pb-[22px] border-b border-white/[0.08] mb-3.5">
          <div className="text-[15px] font-bold text-white">기관 통합관리시스템</div>
          <div className="text-[11px] text-admin-sidebar-icon-muted mt-[5px]">
            {sidebarSubtitle}
          </div>
        </div>
        {navItems.map((navItem) => (
          <NavLink
            key={navItem.to}
            to={navItem.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-6 py-[13px] text-sm font-medium border-l-[3px] ${
                isActive
                  ? "bg-white/[0.08] text-white border-l-admin-brand"
                  : "text-admin-sidebar-border border-l-transparent hover:bg-white/5 hover:text-white"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`w-[22px] h-[22px] flex-none rounded-[4px] flex items-center justify-center text-xs font-bold ${
                    isActive ? "bg-admin-brand text-white" : "bg-white/[0.12]"
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
        <div className="h-[60px] flex-none bg-white border-b border-admin-border-subtle flex items-center justify-between px-8">
          <div className="text-base font-bold">{getTopbarTitle(location.pathname)}</div>
          <div className="flex items-center gap-4 text-xs text-text-subtle">
            <span>
              {sessionRemainingLabel} · {admin?.name ?? admin?.email}
            </span>
            <button
              onClick={() => setPasswordModalOpen(true)}
              className="text-admin-text-secondary font-semibold cursor-pointer bg-transparent border-none hover:underline"
            >
              비밀번호 변경
            </button>
            <button
              onClick={handleLogoutButtonClick}
              className="text-admin-action font-semibold cursor-pointer bg-transparent border-none hover:underline"
            >
              로그아웃
            </button>
          </div>
        </div>

        {admin && <SessionExpiryBanner expiresAt={admin.expiresAt} now={now} />}

        <div className="flex-1 p-7 px-8 overflow-auto">
          <Outlet />
        </div>
      </div>

      {passwordModalOpen && <ChangePasswordModal onClose={() => setPasswordModalOpen(false)} />}
    </div>
  );
};

export default AdminLayout;
