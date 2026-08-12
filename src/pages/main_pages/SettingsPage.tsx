import { useState } from "react";

import AppBar from "../../components/molecule/AppBar";
import LocationConsentModal from "../../components/molecule/LocationConsentModal";
import { pageClass, bodyClass } from "../../components/atoms/classes";
import { isoToKstMinuteString } from "../../utils/timeFormat";

interface SettingsPageProps {
  todayStatus: { locationConsentAt: string | null } | null;
  onHome: () => void;
}

const SettingsPage = ({ todayStatus, onHome }: SettingsPageProps) => {
  const [isLocationGuideOpen, setIsLocationGuideOpen] = useState(false);
  const locationConsentAt = todayStatus?.locationConsentAt ?? null;

  return (
    <div className={pageClass}>
      <AppBar title="설정" onHome={onHome} />
      <div className={bodyClass}>
        <div className="bg-white rounded-[18px] px-[22px] py-5 shadow-[0_2px_8px_rgba(20,30,50,0.05)]">
          <div className="text-[15px] font-extrabold text-text-strong mb-1">위치 수집 안내</div>
          <div className="text-[13.5px] text-text-tertiary font-semibold leading-[1.6]">
            {locationConsentAt
              ? `${isoToKstMinuteString(locationConsentAt)}에 확인했어요`
              : "출근 등록 시 안내를 확인하게 돼요"}
          </div>
          <button
            onClick={() => setIsLocationGuideOpen(true)}
            className="w-full h-[46px] rounded-[12px] bg-surface-page text-[14px] font-extrabold text-text-strong border-none mt-4 cursor-pointer"
          >
            안내 다시 보기
          </button>
        </div>

        <div className="bg-white rounded-[18px] px-[22px] py-5 shadow-[0_2px_8px_rgba(20,30,50,0.05)]">
          <div className="text-[15px] font-extrabold text-text-strong mb-1">개인정보처리방침</div>
          <a
            href="/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-[13.5px] text-brand font-bold mt-1"
          >
            전체 내용 보기
          </a>
        </div>
      </div>

      {isLocationGuideOpen && (
        <LocationConsentModal onConfirm={() => setIsLocationGuideOpen(false)} />
      )}
    </div>
  );
};

export default SettingsPage;
