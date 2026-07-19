import { BASE_URL } from "../client";

const downloadFile = async (path: string, filename: string) => {
  const res = await fetch(`${BASE_URL}${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(`다운로드 실패 (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const downloadActivityLogExcel = (programId: number, month: string) =>
  downloadFile(
    `/api/programs/${programId}/export/activity-log?month=${month}`,
    `활동일지_${month}.csv`,
  );

export const downloadAttendanceExcel = (programId: number, month: string) =>
  downloadFile(
    `/api/programs/${programId}/export/attendance?month=${month}`,
    `출근부_${month}.csv`,
  );

export const downloadPaymentExcel = (programId: number, month: string) =>
  downloadFile(
    `/api/programs/${programId}/export/payment?month=${month}`,
    `급여대장_${month}.csv`,
  );
