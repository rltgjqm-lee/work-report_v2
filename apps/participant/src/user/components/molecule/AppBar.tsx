import { useState, type ReactNode } from "react";

import { ChevronLeft, Home } from "lucide-react";

import { sendSos } from "../../api/sosApi";

import SosConfirmModal from "./SosConfirmModal";

interface AppBarProps {
  title: string;
  onBack?: () => void;
  onHome?: () => void;
  right?: ReactNode;
  // 있으면 우측에 SOS 아이콘을 띄운다. 이 prop을 넘기는 화면은 본인확인이 끝난 뒤에만
  // 진입 가능하다고 보장되는 화면이어야 한다 — 여기선 그 전제로 바로 확인 모달로 이어진다
  // (본인확인 안내 분기는 홈 화면의 SOS 버튼 쪽에만 있다).
  participantId?: number;
}

const AppBar = ({ title, onBack, onHome, right, participantId }: AppBarProps) => {
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);

  const handleSosSend = () => {
    setIsSosModalOpen(false);
    if (!participantId) return;
    sendSos(participantId);
  };

  return (
    <div className="h-[60px] flex-none sticky top-0 z-10 flex items-center gap-1.5 px-[18px] bg-white border-b border-surface-page">
      {onBack && (
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-surface-page border-none flex items-center justify-center flex-none cursor-pointer"
          aria-label="이전으로"
        >
          <ChevronLeft size={22} color="#333d4b" strokeWidth={2.2} />
        </button>
      )}
      {onHome && (
        <button
          onClick={onHome}
          className="w-10 h-10 rounded-xl bg-surface-page border-none flex items-center justify-center flex-none cursor-pointer"
          aria-label="홈으로"
        >
          <Home size={19} color="#333d4b" strokeWidth={2.2} />
        </button>
      )}
      {!onBack && !onHome && <span className="w-10 flex-none" />}
      <span className="flex-1 text-center text-[18px] font-extrabold text-text-strong">
        {title}
      </span>
      {participantId && (
        <button
          onClick={() => setIsSosModalOpen(true)}
          className="w-10 h-10 rounded-xl bg-danger-tint border-none flex items-center justify-center flex-none cursor-pointer"
          aria-label="SOS 긴급 도움 요청"
        >
          <span className="text-lg leading-none">🚨</span>
        </button>
      )}
      {right ?? (!participantId && <span className="w-10 flex-none" />)}

      {isSosModalOpen && (
        <SosConfirmModal onSend={handleSosSend} onCancel={() => setIsSosModalOpen(false)} />
      )}
    </div>
  );
};

export default AppBar;
