const BASE_URL = import.meta.env.VITE_API_BASE_URL;

const request = async <T>(path: string, body: object): Promise<T> => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(data.error || "요청에 실패했습니다.");
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

export const clockIn = (participantId: number) =>
  request<{ id: number; clockIn: string }>("/public/attendance/clock-in", {
    participantId,
  });

export const clockOut = (participantId: number) =>
  request<{ id: number; clockOut: string; totalMinutes: number }>(
    "/public/attendance/clock-out",
    { participantId },
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
