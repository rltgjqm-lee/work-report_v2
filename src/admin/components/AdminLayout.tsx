import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/useAuth";

const navItems = [
  { to: "/admin/organizations", label: "기관 관리", badge: "1" },
  { to: "/admin/programs", label: "사업단 관리", badge: "2" },
];

const getTopbarTitle = (pathname: string) => {
  if (/^\/admin\/programs\/\d+/.test(pathname)) return "사업단 상세";
  if (pathname.startsWith("/admin/programs")) return "사업단 관리";
  if (pathname.startsWith("/admin/organizations")) return "기관 관리";
  return "관리자 콘솔";
};

const AdminLayout = () => {
  const { username, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/admin/login", { replace: true });
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
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
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
                  {item.badge}
                </span>
                {item.label}
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
              {todayLabel} · {username}
            </span>
            <button
              onClick={handleLogout}
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
    </div>
  );
};

export default AdminLayout;
