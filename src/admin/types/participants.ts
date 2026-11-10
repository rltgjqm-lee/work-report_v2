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
  // 입사일 — 역량활용 평일 공휴일 유급 대상(그 공휴일 당시 재직자) 판단용. null이면 사업단 시작일.
  hireDate: string | null;
  createdAt: string;
  // 오늘 하루만 다른 조로 임시 배정된 경우에만 값이 있다 (participants.groupId는 그대로 유지됨)
  todayGroupOverride: { groupId: number; groupName: string } | null;
};

export type ParticipantDetail = Participant & {
  programName: string;
  programType: string | null;
  programHourlyWage: number;
  programStartDate: string;
  groupName: string | null;
  organizationName: string | null;
};

// 참여자 관리 화면(전체 사업단 통합 조회)용 — 그 화면이 실제로 보여주는 필드만 담는다.
export type ParticipantListItem = Pick<
  Participant,
  "id" | "programId" | "name" | "gender" | "demandName"
> & {
  programName: string;
  programType: string | null;
  organizationName: string;
};

// 근무 관리 화면(사업단 단위 근무/교육/휴가 탭)의 수요처 필터·참여자 선택용 — 조인이
// 필요한 오늘 조 임시배정(todayGroupOverride)만 빼고 참여자 원본 필드를 가볍게 받는다.
export type ProgramParticipant = Omit<Participant, "todayGroupOverride">;

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
  // 역량활용은 쓴 연차가 만근한 달 수보다 많으면 0 아래일 수 있다
  remainingDays: number;
  // true면 총 일수를 만근한 달 수로 자동 계산한 것(역량활용) — 직접 정할 수 없다
  autoAccrued: boolean;
};

export type ParticipantMonthlySchedule = {
  participantId: number;
  yearMonth: string;
  workDates: string[] | null;
  maxMonthlyMinutes: number | null;
};
