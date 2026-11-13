const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export type ActivityLogPayload = {
  participantId: number;
  actDate: string;
  startTime: string;
  endTime: string;
  content?: string;
  place?: string;
  hasAccident?: boolean;
  accidentChecked?: boolean;
  accidentDetail?: string;
  accidentAction?: string;
  userSignature?: string;
  demandSignature?: string;
};

// 서버가 거부한 경우 상태코드를 같이 들고 다닌다 — 앱 실패 기록(clientEventLog)에서 "서버에
// 닿았는데 거부됨"과 "네트워크 단계에서 실패"를 구분하는 데 쓴다.
export class ActivityLogApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const createActivityLog = async (payload: ActivityLogPayload): Promise<{ id: number }> => {
  const res = await fetch(`${BASE_URL}/public/activity-logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}) as { error?: string });
    throw new ActivityLogApiError(data.error || "활동일지 서버 저장에 실패했습니다.", res.status);
  }
  return res.json();
};

export const updateActivityLog = async (
  serverId: number,
  payload: ActivityLogPayload,
): Promise<{ id: number }> => {
  const res = await fetch(`${BASE_URL}/public/activity-logs/${serverId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}) as { error?: string });
    throw new ActivityLogApiError(data.error || "활동일지 서버 수정에 실패했습니다.", res.status);
  }
  return res.json();
};
