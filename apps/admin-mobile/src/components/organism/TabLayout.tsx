import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { House, MapPinned, ShieldAlert, UserRound } from "lucide-react";

import { mobileSafetyQueryOptions } from "@work-report/admin-core/api/mobile";

const TABS = [
  { path: "/", label: "홈", Icon: House },
  { path: "/safety", label: "안전", Icon: ShieldAlert },
  { path: "/zones", label: "구역", Icon: MapPinned },
  { path: "/me", label: "내 정보", Icon: UserRound },
];

// 하단 탭 4개(홈/안전/구역/내 정보). 안전 탭엔 미처리 SOS + 진행 중 이탈 수를 붙인다.
const TabLayout = () => {
  const { data: safety } = useQuery(mobileSafetyQueryOptions);
  const openCount =
    (safety?.sos.filter((sos) => sos.status === "OPEN").length ?? 0) +
    (safety?.escapes.filter((escape) => escape.status === "OPEN").length ?? 0);

  return (
    <div className="flex h-full flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <nav className="flex flex-none gap-1 border-t-[1.5px] border-line bg-white px-3 pt-1.5 pb-3">
        {TABS.map(({ path, label, Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === "/"}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-1.5 text-[13px] font-extrabold ${
                isActive ? "text-accent" : "text-ink-muted"
              }`
            }
          >
            <span className="relative">
              <Icon size={24} aria-hidden="true" />
              {path === "/safety" && openCount > 0 && (
                <span
                  aria-label={`확인 필요 ${openCount}건`}
                  className="absolute -top-1.5 left-full -ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-sos px-1.5 text-[11px] font-extrabold text-white"
                >
                  {openCount}
                </span>
              )}
            </span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default TabLayout;
