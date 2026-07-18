import { useMemo } from "react";
import { Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

import type { ActivityLogFormData } from "../../types/form";
import AppBar from "../../components/appshell/AppBar";
import TabBar, { type TabKey } from "../../components/appshell/TabBar";
import { pageClass, btnPrimaryClass } from "../../components/appshell/classes";

interface PageHomeProps {
  formData: ActivityLogFormData;
  onStartNewLog: () => void;
  onChangeTab: (tab: TabKey) => void;
}

const HomePage = ({ formData, onStartNewLog, onChangeTab }: PageHomeProps) => {
  const navigate = useNavigate();

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      }),
    [],
  );

  return (
    <div className={pageClass}>
      <AppBar
        title="활동일지"
        right={
          <button
            onClick={() => navigate("/admin")}
            className="w-10 h-10 flex-none flex items-center justify-center bg-transparent border-none cursor-pointer"
            aria-label="설정"
          >
            <Settings size={20} color="#333d4b" strokeWidth={2} />
          </button>
        }
      />
      <div className="flex-1 flex flex-col items-stretch justify-center px-5 py-9">
        <div className="bg-white rounded-[20px] p-9 text-center shadow-[0_1px_2px_rgba(20,30,50,0.04)]">
          <div className="text-[14px] text-[#9ca3af] font-bold mb-2.5">
            {todayLabel}
          </div>
          <div className="text-[22px] font-extrabold text-[#1f2937] mb-7">
            {formData.userName || "참여자"}님, 환영합니다
          </div>
          <button className={btnPrimaryClass} onClick={onStartNewLog}>
            + 오늘 활동 기록하기
          </button>
        </div>
      </div>
      <TabBar active="home" onChange={onChangeTab} />
    </div>
  );
};

export default HomePage;
