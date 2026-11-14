import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { AndroidSettings, NativeSettings } from "capacitor-native-settings";
import { ChevronRight } from "lucide-react";

import { useSession } from "../context/useSession";

import Card from "../components/atoms/Card";
import ToggleSwitch from "../components/atoms/ToggleSwitch";
import { ROLE_LABELS } from "../lib/format";
import { checkPushPermission, registerForPushNotifications } from "../lib/pushNotifications";

const SettingRow = ({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full items-center gap-3 border-b-[1.5px] border-soft py-4 text-left last:border-b-0"
  >
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-[15px] font-extrabold text-ink">{title}</span>
      <span className="text-[13px] font-bold text-ink-muted">{description}</span>
    </span>
    <ChevronRight size={20} className="flex-none text-ink-faint" aria-hidden="true" />
  </button>
);

const MyInfoPage = () => {
  const navigate = useNavigate();
  const { profile, isLockEnabled, disableLock, logout, pushPermission, refreshPushPermission } =
    useSession();
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (!isNative) return;
    CapacitorApp.getInfo().then((info) => setAppVersion(`${info.version} (${info.build})`));
  }, [isNative]);

  // 휴대폰 설정에서 알림을 켜고 돌아왔을 수 있으니 앱으로 돌아올 때마다 다시 확인한다
  useEffect(() => {
    if (!isNative) return;
    checkPushPermission().then(refreshPushPermission);
    const handlePromise = CapacitorApp.addListener("resume", () => {
      checkPushPermission().then(refreshPushPermission);
    });
    return () => {
      handlePromise.then((handle) => handle.remove());
    };
  }, [isNative, refreshPushPermission]);

  const handleNotificationSettingsClick = () => {
    NativeSettings.openAndroid({ option: AndroidSettings.AppNotification });
  };

  const handleBatterySettingsClick = () => {
    NativeSettings.openAndroid({ option: AndroidSettings.BatteryOptimization });
  };

  const handleTurnOnNotificationsClick = async () => {
    const permission = await registerForPushNotifications();
    refreshPushPermission(permission);
    // 한 번 거절하면 Android가 더 묻지 않으므로 설정 화면으로 보낸다
    if (permission === "denied") handleNotificationSettingsClick();
  };

  const handleLockToggleChange = async (checked: boolean) => {
    if (checked) {
      navigate("/pin");
      return;
    }
    if (window.confirm("앱 잠금을 끄면 폰을 가진 사람 누구나 관리자 앱을 열 수 있어요. 끌까요?")) {
      await disableLock();
    }
  };

  const handleLogoutButtonClick = async () => {
    if (window.confirm("로그아웃하면 이 폰으로 SOS 알림이 오지 않아요. 로그아웃할까요?")) {
      await logout();
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-none flex-col gap-5 bg-accent px-5 pt-[22px] pb-6">
        <h1 className="text-[15px] font-extrabold text-white/85">내 정보</h1>
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 flex-none items-center justify-center rounded-[22px] bg-white/20 text-[26px] font-extrabold text-white">
            {(profile?.name ?? profile?.email ?? "?").slice(0, 1)}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[24px] font-extrabold text-white">
                {profile?.name ?? "이름 없음"}
              </span>
              {profile?.role && (
                <span className="flex-none rounded-full bg-white/20 px-3 py-1 text-xs font-extrabold text-white">
                  {ROLE_LABELS[profile.role] ?? profile.role}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm leading-normal font-semibold break-all text-white/85">
              {profile?.organizationName && (
                <>
                  {profile.organizationName}
                  <br />
                </>
              )}
              {profile?.email}
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h2 className="mt-1 px-1 text-sm font-extrabold text-ink-muted">알림</h2>
        {pushPermission === "denied" && (
          <button
            type="button"
            onClick={handleTurnOnNotificationsClick}
            className="flex flex-col gap-1 rounded-[18px] bg-sos-soft px-[18px] py-4 text-left"
          >
            <span className="text-[15px] font-extrabold text-sos-deep">알림이 꺼져 있어요</span>
            <span className="text-[13px] font-bold text-sos-ink">
              SOS가 와도 알 수 없어요. 눌러서 알림을 켜주세요.
            </span>
          </button>
        )}
        <Card className="px-[18px] py-0.5">
          <SettingRow
            title="SOS 알림 소리·방해금지 설정"
            description={isNative ? "휴대폰 알림 설정으로 이동해요" : "앱에서만 열 수 있어요"}
            onClick={handleNotificationSettingsClick}
          />
          <SettingRow
            title="배터리 최적화 제외"
            description="알림이 늦게 오면 목록에서 이 앱을 '제한 없음'으로 바꿔주세요"
            onClick={handleBatterySettingsClick}
          />
        </Card>

        <h2 className="mt-3 px-1 text-sm font-extrabold text-ink-muted">보안</h2>
        <Card className="px-[18px] py-0.5">
          <div className="flex items-center gap-3 border-b-[1.5px] border-soft py-4">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-extrabold text-ink">앱 잠금 (지문/PIN)</span>
              <span className="text-[13px] font-bold text-ink-muted">
                앱을 다시 열 때 잠금을 풀어야 해요
              </span>
            </span>
            <ToggleSwitch
              checked={isLockEnabled}
              label="앱 잠금"
              onChange={handleLockToggleChange}
            />
          </div>
          {isLockEnabled && (
            <SettingRow
              title="PIN 변경"
              description="새 PIN 6자리를 두 번 입력해요"
              onClick={() => navigate("/pin")}
            />
          )}
        </Card>

        <button
          type="button"
          onClick={handleLogoutButtonClick}
          className="mt-4 h-14 rounded-[18px] bg-white text-base font-extrabold text-sos-ink shadow-[0_2px_8px_rgba(20,30,50,.05)]"
        >
          로그아웃
        </button>
        <p className="py-2 text-center text-[13px] font-bold text-ink-muted">
          앱 버전 {appVersion ?? "웹 미리보기"}
        </p>
      </div>
    </div>
  );
};

export default MyInfoPage;
