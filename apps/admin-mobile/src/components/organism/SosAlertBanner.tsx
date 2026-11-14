import { useNavigate } from "react-router-dom";

import { X } from "lucide-react";

import { useSession } from "../../context/useSession";

// 앱을 보고 있을 때 SOS 알림이 오면 시스템 알림 대신 화면 맨 위에 띄운다
const SosAlertBanner = () => {
  const navigate = useNavigate();
  const { incomingSos, dismissIncomingSos } = useSession();
  if (!incomingSos) return null;

  const handleBannerClick = () => {
    dismissIncomingSos();
    navigate(incomingSos.sosEventId ? `/sos?id=${incomingSos.sosEventId}` : "/safety");
  };

  return (
    <div className="fixed inset-x-3 top-3 z-50 flex items-center gap-3 rounded-2xl bg-sos px-4 py-3.5 text-white shadow-[0_8px_24px_rgba(185,28,28,.35)]">
      <button
        type="button"
        onClick={handleBannerClick}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-white/20 text-xs font-black">
          SOS
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-base font-extrabold">
            {incomingSos.participantName ?? "참여자"} 님이 SOS를 눌렀어요
          </span>
          <span className="text-[13px] font-bold text-white/85">눌러서 바로 확인하기</span>
        </span>
      </button>
      <button
        type="button"
        onClick={dismissIncomingSos}
        aria-label="알림 닫기"
        className="flex-none p-1"
      >
        <X size={20} aria-hidden="true" />
      </button>
    </div>
  );
};

export default SosAlertBanner;
