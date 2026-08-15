import ExcelJS from "exceljs";

import type { ActivityLogItem } from "../../../types/form";
import { addActivityLogSheet } from "../../utils/excel/downloadActivityLogExcel";
import { buildActivityPaymentLedgerWorkbook } from "../../utils/excel/downloadActivityPaymentLedgerExcel";
import {
  downloadCapacityAttendanceWorkbook,
  type CapacityAttendanceParticipant,
} from "../../utils/excel/downloadCapacityAttendanceExcel";
import {
  downloadPaymentLedgerWorkbook,
  type PaymentLedgerParticipant,
} from "../../utils/excel/downloadPaymentLedgerExcel";
import {
  downloadPayslipWorkbook,
  type PayslipParticipant,
} from "../../utils/excel/downloadPayslipExcel";
import {
  downloadWorkScheduleWorkbook,
  type WorkScheduleParticipant,
} from "../../utils/excel/downloadWorkScheduleExcel";

import { request } from "../client";

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
  const diffMinutesTotal = endHour * 60 + endMinute - (startHour * 60 + startMinute);
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
  title?: string | null,
) => {
  const data = await request<ActivityLogExportResponse>(
    `/api/programs/${programId}/export/activity-log?month=${month}`,
  );

  const workbook = new ExcelJS.Workbook();
  const usedSheetNames = new Set<string>();

  data.participants.forEach((participant) => {
    const sheetName = sanitizeSheetName(participant.participantName, usedSheetNames);
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
        title,
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
        title,
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

interface CapacityAttendanceExportResponse {
  programName: string;
  month: string;
  participants: CapacityAttendanceParticipant[];
}

export const downloadAttendanceExcel = async (programId: number, month: string) => {
  const data = await request<CapacityAttendanceExportResponse>(
    `/api/programs/${programId}/export/attendance?month=${month}`,
  );
  await downloadCapacityAttendanceWorkbook(data.programName, data.month, data.participants);
};

interface PaymentLedgerExportResponse {
  programName: string;
  month: string;
  healthInsuranceRate: number;
  longtermCareRate: number;
  employmentInsuranceRate: number;
  employmentInsuranceEmployerRate: number;
  industrialAccidentRate: number;
  participants: PaymentLedgerParticipant[];
}

export const downloadPaymentExcel = async (programId: number, month: string) => {
  const data = await request<PaymentLedgerExportResponse>(
    `/api/programs/${programId}/export/payment?month=${month}`,
  );

  await downloadPaymentLedgerWorkbook(
    {
      programName: data.programName,
      month: data.month,
      healthInsuranceRate: data.healthInsuranceRate,
      longtermCareRate: data.longtermCareRate,
      employmentInsuranceRate: data.employmentInsuranceRate,
      employmentInsuranceEmployerRate: data.employmentInsuranceEmployerRate,
      industrialAccidentRate: data.industrialAccidentRate,
    },
    data.participants,
  );
};

interface WorkScheduleExportResponse {
  organizationName: string;
  organizationRep: string;
  organizationAddress: string;
  month: string;
  participants: WorkScheduleParticipant[];
}

export const downloadWorkScheduleExcel = async (programId: number, month: string) => {
  const data = await request<WorkScheduleExportResponse>(
    `/api/programs/${programId}/export/work-schedule?month=${month}`,
  );

  await downloadWorkScheduleWorkbook(
    {
      organizationName: data.organizationName,
      organizationRep: data.organizationRep,
      organizationAddress: data.organizationAddress,
      month: data.month,
    },
    data.participants,
  );
};

interface PayslipExportResponse {
  organizationName: string;
  month: string;
  healthInsuranceRate: number;
  longtermCareRate: number;
  employmentInsuranceRate: number;
  participants: PayslipParticipant[];
}

export const downloadPayslipExcel = async (programId: number, month: string) => {
  const data = await request<PayslipExportResponse>(
    `/api/programs/${programId}/export/payslip?month=${month}`,
  );

  await downloadPayslipWorkbook(
    {
      organizationName: data.organizationName,
      month: data.month,
      healthInsuranceRate: data.healthInsuranceRate,
      longtermCareRate: data.longtermCareRate,
      employmentInsuranceRate: data.employmentInsuranceRate,
    },
    data.participants,
  );
};

interface ActivityPaymentExportResponse {
  programName: string;
  organizationName: string;
  participants: {
    name: string;
    demandName: string | null;
    minutes: number;
    hourlyWage: number;
  }[];
}

export const downloadActivityPaymentLedgerExcel = async (programId: number, month: string) => {
  const data = await request<ActivityPaymentExportResponse>(
    `/api/programs/${programId}/export/activity-payment?month=${month}`,
  );

  const buffer = await buildActivityPaymentLedgerWorkbook(
    {
      programName: data.programName,
      organizationName: data.organizationName,
      month,
    },
    data.participants,
  );

  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `활동비지급대장_${month}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};
