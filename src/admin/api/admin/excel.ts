import ExcelJS from "exceljs";

import { addActivityLogSheet } from "../../../utils/downloadActivityLogExcel";
import type { ActivityLogItem } from "../../../types/form";
import { BASE_URL, request } from "../client";

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

interface ActivityLogExportLog {
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
}

interface ActivityLogExportParticipant {
  participantName: string;
  demandName: string | null;
  logs: ActivityLogExportLog[];
}

interface ActivityLogExportResponse {
  programName: string;
  organizationName: string;
  participants: ActivityLogExportParticipant[];
}

const computeTotalTimeLabel = (startTime: string, endTime: string) => {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const diffMinutesTotal =
    endHour * 60 + endMinute - (startHour * 60 + startMinute);
  const diffHour = Math.floor(diffMinutesTotal / 60);
  const diffMinute = diffMinutesTotal % 60;
  return diffMinute > 0 ? `${diffHour}시간 ${diffMinute}분` : `${diffHour}시간`;
};

// 시트명은 31자 제한 + \ / ? * [ ] : 사용 불가, 동명이인은 (2), (3)으로 구분
const sanitizeSheetName = (name: string, usedNames: Set<string>) => {
  const base = name.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "참여자";
  let candidate = base;
  let suffix = 2;
  while (usedNames.has(candidate)) {
    candidate = `${base.slice(0, 27)}(${suffix})`;
    suffix += 1;
  }
  usedNames.add(candidate);
  return candidate;
};

export const downloadActivityLogExcel = async (
  programId: number,
  month: string,
) => {
  const data = await request<ActivityLogExportResponse>(
    `/api/programs/${programId}/export/activity-log?month=${month}`,
  );

  const workbook = new ExcelJS.Workbook();
  const usedSheetNames = new Set<string>();

  data.participants.forEach((participant) => {
    const sheetName = sanitizeSheetName(
      participant.participantName,
      usedSheetNames,
    );
    const logs: ActivityLogItem[] = participant.logs.map((log) => ({
      date: log.actDate,
      start: log.startTime,
      end: log.endTime,
      totalTime: computeTotalTimeLabel(log.startTime, log.endTime),
      content: log.content ?? "",
      place: log.place ?? "",
      accident: log.hasAccident ? "유" : "무",
      accidentDetail: log.accidentDetail ?? undefined,
      accidentAction: log.accidentAction ?? undefined,
      uSign: log.userSignature ?? "",
      dSign: log.demandSignature ?? "",
      timestamp: new Date(log.actDate).getTime(),
    }));

    addActivityLogSheet(
      workbook,
      sheetName,
      {
        orgName: data.organizationName,
        programName: data.programName,
        participantName: participant.participantName,
        demandName: participant.demandName ?? "",
      },
      logs,
    );
  });

  if (data.participants.length === 0) {
    addActivityLogSheet(
      workbook,
      "활동일지",
      {
        orgName: data.organizationName,
        programName: data.programName,
        participantName: "",
        demandName: "",
      },
      [],
    );
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `활동일지_${month}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};

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
