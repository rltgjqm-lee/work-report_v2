const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export type ServerActivityLog = {
  id: number;
  participantId: number;
  actDate: string;
  startTime: string;
  endTime: string;
  content: string | null;
  place: string | null;
  hasAccident: boolean;
  accidentDetail: string | null;
  accidentAction: string | null;
  userSignature: string | null;
  demandSignature: string | null;
  createdAt: string;
};

export type ActivityLogPayload = {
  participantId: number;
  actDate: string;
  startTime: string;
  endTime: string;
  content?: string;
  place?: string;
  hasAccident?: boolean;
  accidentDetail?: string;
  accidentAction?: string;
  userSignature?: string;
  demandSignature?: string;
};

export const createActivityLog = async (
  payload: ActivityLogPayload,
): Promise<{ id: number }> => {
  const res = await fetch(`${BASE_URL}/public/activity-logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(data.error || "활동일지 서버 저장에 실패했습니다.");
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
    throw new Error(data.error || "활동일지 서버 수정에 실패했습니다.");
  }
  return res.json();
};

export const listActivityLogs = async (
  participantId: number,
  month: string,
): Promise<ServerActivityLog[]> => {
  const res = await fetch(
    `${BASE_URL}/public/activity-logs?participantId=${participantId}&month=${month}`,
  );
  if (!res.ok) throw new Error("활동일지 조회에 실패했습니다.");
  return res.json();
};
