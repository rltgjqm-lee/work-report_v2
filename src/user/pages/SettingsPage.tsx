import { useEffect, useState } from "react";

import { Capacitor } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";

import { isoToKstMinuteString } from "../../utils/timeFormat";

import { bodyClass, pageClass } from "../../components/atoms/classes";

import AppBar from "../components/molecule/AppBar";
import LocationConsentModal from "../components/molecule/LocationConsentModal";

interface SettingsPageProps {
  todayStatus: { locationConsentAt: string | null } | null;
  // 설정 화면은 홈의 톱니바퀴 아이콘으로 본인확인 전에도 들어올 수 있어서, 다른 화면들과
  // 달리 participantId가 없을 수 있다 — 그때는 SOS 버튼을 아예 안 띄운다.
  participantId: number | undefined;
  onBack: () => void;
}

const SettingsPage = ({ todayStatus, participantId, onBack }: SettingsPageProps) => {
  const [isLocationGuideOpen, setIsLocationGuideOpen] = useState(false);
  const locationConsentAt = todayStatus?.locationConsentAt ?? null;

  const [otaVersion, setOtaVersion] = useState<string | null>(null);

  // 원격 지원 시 참여자가 이 화면을 캡처해서 보내면, 기기에 실제로 어떤 OTA 번들이
  // 적용돼 있는지(업데이트가 안 내려온 건지, 내려왔는데 안 먹은 건지) 바로 확인할 수 있다.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    CapacitorUpdater.current()
      .then((current) => setOtaVersion(current.bundle.version))
      .catch(() => {});
  }, []);

  return (
    <div className={pageClass}>
      <AppBar title="설정" onBack={onBack} participantId={participantId} />
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
        {otaVersion && (
          <div className="text-center text-[12px] text-text-tertiary font-semibold">
            앱 버전: {otaVersion}
          </div>
        )}
      </div>

      {isLocationGuideOpen && (
        <LocationConsentModal onConfirm={() => setIsLocationGuideOpen(false)} />
      )}
    </div>
  );
};

export default SettingsPage;
