import { useState, type ReactNode } from "react";

import { Home } from "lucide-react";

import type { ActivityLogFormData } from "../../types/form";
import { programTypeShortLabel } from "../../types/form";

import { sendSos } from "../api/sosApi";
import SosConfirmModal from "../components/molecule/SosConfirmModal";

type ModuleItemLargeProps = {
  index: number;
  icon: string;
  category: string;
  title: string;
  status: ReactNode;
  done: boolean;
  ready: boolean;
  isPending?: boolean;
  onClick: () => void;
};

interface ActivityDashboardPageLargeFontProps {
  formData: ActivityLogFormData;
  todayLabel: string;
  notificationsBlocked: boolean;
  isDebugPanelVisible: boolean;
  debugDate: string;
  setDebugDate: (value: string) => void;
  debugTime: string;
  setDebugTime: (value: string) => void;
  onDebugDateTimeReset: () => void;
  modules: ModuleItemLargeProps[];
  onHome: () => void;
}

const ModuleItemLarge = ({
  index,
  icon,
  title,
  status,
  done,
  ready,
  isPending,
  onClick,
}: ModuleItemLargeProps) => {
  const isActive = !done && ready;

  return (
    <div
      className={`bg-white rounded-2xl px-[20px] py-[18px] flex flex-col gap-4 shadow-[0_1px_2px_rgba(20,30,50,0.04)] ${
        isActive ? "border-[3px] border-brand" : ""
      }`}
    >
      <div className="flex items-center gap-4 min-w-0">
        <img src={icon} alt="" className="w-[48px] h-[48px] flex-none" />
        <div className="min-w-0">
          <div className="text-[22px] font-bold text-text-strong">
            {index}. {title}
          </div>
          <div className="text-[17px] text-text-muted font-medium mt-0.5">{status}</div>
        </div>
      </div>
      {(done || ready) && (
        <button
          onClick={onClick}
          disabled={isPending}
          className={`w-full h-[58px] rounded-xl border-none text-[20px] font-extrabold ${
            isPending
              ? "bg-surface-page text-text-muted cursor-default"
              : `cursor-pointer ${done ? "bg-surface-page text-text-tertiary" : "bg-brand text-white"}`
          }`}
        >
          {isPending ? "확인 중" : done ? "확인" : "등록"}
        </button>
      )}
    </div>
  );
};

// 근무 기록 대시보드 큰글씨 버전 — 보통글씨 버전(ActivityDashboardPage.tsx + AppBar)과
// 배경·카드·버튼 색/모서리/그림자는 완전히 동일하고 글자·아이콘·여백 크기만 키운
// 스킨이다. 출퇴근/모듈 진행 로직은 ActivityDashboardPage가 그대로 소유하고
// 계산된 모듈 목록·상태만 내려준다.
const ActivityDashboardPageLargeFont = ({
  formData,
  todayLabel,
  notificationsBlocked,
  isDebugPanelVisible,
  debugDate,
  setDebugDate,
  debugTime,
  setDebugTime,
  onDebugDateTimeReset,
  modules,
  onHome,
}: ActivityDashboardPageLargeFontProps) => {
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);

  const handleSosSend = () => {
    setIsSosModalOpen(false);
    if (!formData.participantId) return;
    sendSos(formData.participantId);
  };

  return (
    <div className="flex flex-col bg-surface-page h-full min-h-0 flex-1 overflow-y-auto">
      <div className="flex-none sticky top-0 z-10 flex items-center gap-2 px-[16px] py-[10px] bg-white border-b border-surface-page">
        <button
          onClick={onHome}
          className="w-[44px] h-[44px] rounded-xl bg-surface-page border-none flex items-center justify-center flex-none cursor-pointer"
          aria-label="홈으로"
        >
          <Home size={22} color="#333d4b" strokeWidth={2.2} />
        </button>
        <span className="flex-1 text-center text-[20px] font-extrabold text-text-strong">
          근무 기록
        </span>
        {formData.participantId ? (
          <button
            onClick={() => setIsSosModalOpen(true)}
            className="w-[44px] h-[44px] rounded-xl bg-danger-tint border-none flex items-center justify-center flex-none cursor-pointer"
            aria-label="SOS 긴급 도움 요청"
          >
            <span className="text-[20px] leading-none">🚨</span>
          </button>
        ) : (
          <span className="w-[44px] flex-none" />
        )}
      </div>

      <div className="px-[16px] py-[20px] flex-1 flex flex-col gap-5">
        <div className="bg-white rounded-[20px] px-6 py-5 shadow-[0_2px_8px_rgba(20,30,50,0.05)]">
          <div className="text-[15px] text-text-subtitle font-medium mb-1">
            {todayLabel} · {formData.userName || "참여자"}님
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[clamp(19px,5.5vw,24px)] font-bold text-text-strong min-w-0">
              {formData.orgName}
            </span>
            <span className="inline-flex flex-none text-[14px] font-extrabold px-3 py-1 rounded-xl bg-brand-tint text-brand">
              {programTypeShortLabel(formData.programType)}
            </span>
          </div>
          <div className="mt-3">
            <div className="py-[10px] flex items-center justify-between gap-3">
              <span className="text-[14px] font-semibold text-text-subtitle">사업단</span>
              <span className="text-[16px] font-bold text-text-strong">{formData.programName}</span>
            </div>
            <div className="border-t border-surface-page" />
            <div className="py-[10px] flex items-center justify-between gap-3">
              <span className="text-[14px] font-semibold text-text-subtitle">수요처</span>
              <span className="text-[16px] font-bold text-text-strong">{formData.demandName}</span>
            </div>
          </div>
        </div>

        {notificationsBlocked && (
          <div className="bg-danger-tint rounded-2xl px-6 py-5 border border-caution-border-subtle">
            <span className="text-[17px] font-bold text-danger-text-strong">
              🔕 알림이 꺼져 있어요 — 휴대폰 설정에서 이 앱의 알림을 켜야 재난 문자를 받을 수
              있어요.
            </span>
          </div>
        )}

        {isDebugPanelVisible && (
          <div className="bg-badge-bg rounded-2xl px-6 py-5 flex items-center gap-3 border border-badge-border flex-wrap">
            <span className="text-[17px] font-extrabold text-caution-text flex-none">
              🧪 테스트용 날짜/시간
            </span>
            <input
              type="date"
              value={debugDate}
              onChange={(event) => setDebugDate(event.target.value)}
              className="flex-1 h-11 px-2.5 rounded-lg border border-badge-border text-[17px] font-semibold text-text-strong bg-white"
            />
            <input
              type="time"
              value={debugTime}
              onChange={(event) => setDebugTime(event.target.value)}
              className="flex-1 h-11 px-2.5 rounded-lg border border-badge-border text-[17px] font-semibold text-text-strong bg-white"
            />
            {(debugDate || debugTime) && (
              <button
                onClick={onDebugDateTimeReset}
                className="flex-none h-11 px-4 rounded-lg border-none bg-white text-[16px] font-bold text-caution-text cursor-pointer"
              >
                초기화
              </button>
            )}
          </div>
        )}

        {modules.map((module) => (
          <ModuleItemLarge key={module.category} {...module} />
        ))}
      </div>

      {isSosModalOpen && (
        <SosConfirmModal onSend={handleSosSend} onCancel={() => setIsSosModalOpen(false)} />
      )}
    </div>
  );
};

export default ActivityDashboardPageLargeFont;
