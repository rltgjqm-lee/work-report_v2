// 이 기기의 고유 번호 — 처음 한 번 무작위로 만들어 폰에 저장해 두고, 본인 확인·출퇴근 요청에
// 같이 보낸다. 서버는 참여자마다 처음 쓴 기기 번호로 고정해 다른 기기에서의 대리 출근을 막는다
// (apps/worker/src/lib/deviceBinding.ts). 앱을 지웠다 다시 깔거나 앱 데이터를 지우면 새 번호가 생겨
// 다른 기기로 보이므로, 그때는 관리자가 기기 등록을 해제해야 한다.
const STORAGE_KEY = "workreport_device_id";

const createDeviceId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

// 폰 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 이번 실행 동안만 쓰는 번호로 대신한다
let memoryDeviceId: string | null = null;

export const getDeviceId = (): string => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
    const created = createDeviceId();
    localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    memoryDeviceId ??= createDeviceId();
    return memoryDeviceId;
  }
};
