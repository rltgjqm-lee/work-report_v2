import { useState } from "react";

import { ChevronLeft } from "lucide-react";

import { isoToKstMinuteString } from "../../utils/timeFormat";

import { sendSos } from "../api/sosApi";
import SosConfirmModal from "../components/molecule/SosConfirmModal";

interface SettingsPageLargeFontProps {
  onBack: () => void;
  // 설정 화면은 홈의 톱니바퀴 아이콘으로 본인확인 전에도 들어올 수 있어서 없을 수 있다 —
  // 그때는 SOS 버튼을 아예 안 띄운다(AppBar와 동일 기준).
  participantId: number | undefined;
  locationConsentAt: string | null;
  otaVersion: string | null;
  onOpenLocationGuide: () => void;
}

// 설정 화면 큰글씨 버전 — 보통글씨 버전(SettingsPage.tsx + AppBar)과 배경·카드·버튼
// 색/레이아웃은 완전히 동일하고 글자·아이콘·여백 크기만 키운 스킨이다. AppBar는 다른
// 여러 화면이 같이 쓰는 공용 컴포넌트라 여기서만 크게 바꿀 수 없어서, AppBar와 같은
// 색/구조를 그대로 따라 직접 그린다.
const SettingsPageLargeFont = ({
  onBack,
  participantId,
  locationConsentAt,
  otaVersion,
  onOpenLocationGuide,
}: SettingsPageLargeFontProps) => {
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);

  const handleSosSend = () => {
    setIsSosModalOpen(false);
    if (!participantId) return;
    sendSos(participantId);
  };

  return (
    <div className="flex flex-col bg-surface-page h-full min-h-0 flex-1 overflow-y-auto">
      <div className="flex-none sticky top-0 z-10 flex items-center gap-2.5 px-[22px] py-3 bg-white border-b border-surface-page">
        <button
          onClick={onBack}
          className="w-14 h-14 rounded-xl bg-surface-page border-none flex items-center justify-center flex-none cursor-pointer"
          aria-label="이전으로"
        >
          <ChevronLeft size={28} color="#333d4b" strokeWidth={2.2} />
        </button>
        <span className="flex-1 text-center text-[24px] font-extrabold text-text-strong">
          설정
        </span>
        {participantId ? (
          <button
            onClick={() => setIsSosModalOpen(true)}
            className="w-14 h-14 rounded-xl bg-danger-tint border-none flex items-center justify-center flex-none cursor-pointer"
            aria-label="SOS 긴급 도움 요청"
          >
            <span className="text-[24px] leading-none">🚨</span>
          </button>
        ) : (
          <span className="w-14 flex-none" />
        )}
      </div>

      <div className="px-5 pt-5 pb-6 flex-1 flex flex-col gap-4">
        <div className="bg-white rounded-[20px] px-7 py-6 shadow-[0_2px_8px_rgba(20,30,50,0.05)]">
          <div className="text-[20px] font-extrabold text-text-strong mb-1.5">위치 수집 안내</div>
          <div className="text-[18px] text-text-tertiary font-semibold leading-[1.6]">
            {locationConsentAt
              ? `${isoToKstMinuteString(locationConsentAt)}에 확인했어요`
              : "출근 등록 시 안내를 확인하게 돼요"}
          </div>
          <button
            onClick={onOpenLocationGuide}
            className="w-full h-[58px] rounded-[14px] bg-surface-page text-[18px] font-extrabold text-text-strong border-none mt-5 cursor-pointer"
          >
            안내 다시 보기
          </button>
        </div>

        <div className="bg-white rounded-[20px] px-7 py-6 shadow-[0_2px_8px_rgba(20,30,50,0.05)]">
          <div className="text-[20px] font-extrabold text-text-strong mb-1.5">
            개인정보처리방침
          </div>
          <a
            href="/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-[18px] text-brand font-bold mt-1"
          >
            전체 내용 보기
          </a>
        </div>

        {otaVersion && (
          <div className="text-center text-[16px] text-text-tertiary font-semibold">
            앱 버전: {otaVersion}
          </div>
        )}
      </div>

      {isSosModalOpen && (
        <SosConfirmModal onSend={handleSosSend} onCancel={() => setIsSosModalOpen(false)} />
      )}
    </div>
  );
};

export default SettingsPageLargeFont;
