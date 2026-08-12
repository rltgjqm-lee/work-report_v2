type ParticipantStatus = "ACTIVE" | "DROPPED" | "ON_LEAVE";

export type Participant = {
  id: number;
  programId: number;
  groupId: number | null;
  name: string;
  gender: "남성" | "여성" | null;
  demandName: string | null;
  demandSiteId: number | null;
  birthYear: number | null;
  status: ParticipantStatus;
  droppedAt: string | null;
  dropReason: string | null;
  leaveStart: string | null;
  leaveEnd: string | null;
  hourlyWage: number | null;
  educationAmount: number;
  educationType: "add" | "deduct" | "none";
  dementiaAmount: number;
  dementiaType: "add" | "deduct" | "none";
  healthInsuranceEnrolled: boolean;
  longtermCareInsuranceEnrolled: boolean;
  employmentInsuranceEnrolled: boolean;
  industrialAccidentInsuranceEnrolled: boolean;
  weeklyHolidayHours: number;
  createdAt: string;
  // 오늘 하루만 다른 조로 임시 배정된 경우에만 값이 있다 (participants.groupId는 그대로 유지됨)
  todayGroupOverride: { groupId: number; groupName: string } | null;
};

export type ParticipantDetail = Participant & {
  programName: string;
  programType: string | null;
  programHourlyWage: number;
  groupName: string | null;
  organizationName: string | null;
};

export type LeaveType = "PAID" | "UNPAID";

export type ParticipantLeave = {
  id: number;
  participantId: number;
  leaveStart: string;
  leaveEnd: string;
  leaveType: LeaveType;
  leaveDays: number;
  reason: string | null;
  createdBy: number;
  createdAt: string;
};

export type AnnualLeave = {
  participantId: number;
  year: string;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
};

export type ParticipantMonthlySchedule = {
  participantId: number;
  yearMonth: string;
  workDates: string[] | null;
  maxMonthlyMinutes: number | null;
};
