import { Capacitor } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

type LatestOtaResponse = {
  version: string | null;
  checksum?: string;
  url?: string;
};

// 앱을 실행할 때마다 최신 웹 번들을 확인하고, 있으면 다운로드해 즉시 적용한다.
// 네이티브 플랫폼(iOS/Android)에서만 동작하고, 실패해도 조용히 무시해서 기존 번들로
// 정상 부팅되게 한다(웹 배포와 달리 스토어 심사 없이 프론트 코드를 즉시 반영하기 위한 장치).
export const checkAndApplyOtaUpdate = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // 반드시 네트워크 요청 이전에 호출해야 한다 — 이 호출이 없으면 플러그인이 현재 번들을
    // "정상 부팅 실패"로 간주해 자동으로 이전 번들로 롤백한다.
    await CapacitorUpdater.notifyAppReady();

    const current = await CapacitorUpdater.current();
    const currentVersion = current.bundle.version;

    const response = await fetch(
      `${BASE_URL}/public/ota/latest?currentVersion=${encodeURIComponent(currentVersion)}`,
    );
    const latest: LatestOtaResponse = await response.json();
    if (!latest.version || !latest.url) return;

    const bundle = await CapacitorUpdater.download({
      url: `${BASE_URL}${latest.url}`,
      version: latest.version,
      checksum: latest.checksum,
    });

    // set()은 즉시 리로드까지 수행하는 종료 호출이라 이 다음 코드는 실행되지 않는다.
    await CapacitorUpdater.set({ id: bundle.id });
  } catch (error) {
    console.error("OTA 업데이트 확인/적용 실패", error);
  }
};
