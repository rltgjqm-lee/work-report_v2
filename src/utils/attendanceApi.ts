const BASE_URL = import.meta.env.VITE_API_BASE_URL;

// credentials: "include" — 이 브라우저에 관리자 콘솔 로그인 세션 쿠키가 있으면 같이
// 실려가서, 서버가 출퇴근 테스트용 날짜/시간 override를 통합관리자에게만 허용하는 데 쓴다.
// 일반 참여자는 그 쿠키가 없으니 그냥 무시될 뿐 평소 동작엔 영향이 없다.
const request = async <T>(
  path: string,
  body: object,
  method: "POST" | "PATCH" = "POST",
): Promise<T> => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(data.error || "요청에 실패했습니다.");
  }
  return res.json();
};

// 참여자 앱에서 "테스트용 날짜/시간" 패널을 실서버에서도 통합관리자에게만 보여주기
// 위한 체크 — 관리자 세션 쿠키가 없거나 만료됐으면 조용히 null을 돌려준다.
export const getCurrentAdminRole = async (): Promise<string | null> => {
  try {
    const res = await fetch(`${BASE_URL}/api/me`, { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as { role?: string };
    return data.role ?? null;
  } catch {
    return null;
  }
};

// 오늘 실제 출퇴근 기록(서버 attendance_logs)을 조회 — 홈 화면의 출근/퇴근 상태는
// 브라우저 로컬 캐시가 아니라 이 값을 기준으로 맞춘다(캐시가 없거나 어긋나도 정확하도록).
export const getTodayAttendance = async (
  participantId: number,
): Promise<{ clockIn: string | null; clockOut: string | null }> => {
  const res = await fetch(
    `${BASE_URL}/public/attendance/today?participantId=${participantId}`,
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(data.error || "출퇴근 기록 조회에 실패했습니다.");
  }
  return res.json();
};

export const identifyParticipant = (
  programId: number,
  name: string,
  phoneLast4: string,
) =>
  request<{ participantId: number; name: string }>(
    "/public/attendance/identify",
    { programId, name, phoneLast4 },
  );

// debug.date("YYYY-MM-DD")/debug.time("HH:MM")은 출퇴근 날짜·시간 검증을 테스트하기
// 위한 override — 서버가 localhost 요청이거나 통합관리자 세션일 때만 실제로 반영한다.
export type DebugAttendanceOverride = { date?: string; time?: string };

export const clockIn = (
  participantId: number,
  debug?: DebugAttendanceOverride,
) =>
  request<{ id: number; clockIn: string }>("/public/attendance/clock-in", {
    participantId,
    ...(debug?.date && { debugDate: debug.date }),
    ...(debug?.time && { debugTime: debug.time }),
  });

export const clockOut = (
  participantId: number,
  debug?: DebugAttendanceOverride,
) =>
  request<{ id: number; clockOut: string; totalMinutes: number }>(
    "/public/attendance/clock-out",
    {
      participantId,
      ...(debug?.date && { debugDate: debug.date }),
      ...(debug?.time && { debugTime: debug.time }),
    },
  );

// signatureDataUrl은 캔버스가 만든 base64 data URL이지만, 여기서 바로 바이너리로
// 되돌려서 서버에는 base64를 거치지 않고 진짜 PNG 바이트로 전송한다.
export const signAttendance = async (
  participantId: number,
  signatureDataUrl: string,
): Promise<{ id: number; signatureKey: string }> => {
  const blob = await (await fetch(signatureDataUrl)).blob();
  const res = await fetch(
    `${BASE_URL}/public/attendance/sign?participantId=${participantId}`,
    {
      method: "POST",
      headers: { "Content-Type": blob.type || "image/png" },
      body: blob,
    },
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(data.error || "요청에 실패했습니다.");
  }
  return res.json();
};
