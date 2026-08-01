export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ORGANIZATION_ADMIN: "ORGANIZATION_ADMIN",
  SUB_ADMIN: "SUB_ADMIN",
  MANAGER: "MANAGER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export type AdminSession = {
  id: number;
  email: string;
  name: string | null;
  role: Role;
  organizationId: number | null;
  programIds: number[];
  groupIds: number[];
  expiresAt: string;
};

export type Organization = {
  id: number;
  name: string;
  address: string | null;
  rep: string | null;
  phone: string | null;
  fax: string | null;
  bizNo: string | null;
  regionSido: string | null;
  regionSigungu: string | null;
  organizationType: string | null;
  prjYear: string | null;
  isActive: boolean;
  createdAt: string;
};

export type Program = {
  id: number;
  organizationId: number;
  name: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  programType: string | null;
  hourlyWage: number;
  healthInsuranceRate: number;
  longtermCareRate: number;
  employmentInsuranceRate: number;
  employmentInsuranceEmployerRate: number;
  industrialAccidentRate: number;
  annualLeaveDailyWage: number;
  isActive: boolean;
  createdAt: string;
};

export type DemandSite = {
  id: number;
  programId: number;
  name: string;
  address: string | null;
  // 담당자 계정. contactPerson은 계정 연결 이전에 자유 입력으로 쌓인 값(읽기용 대체값)
  contactAdminId: number | null;
  contactAdminName?: string | null;
  contactPerson: string | null;
  // 수요처 단위 기본 관제구역 — 하위 거점을 안 그려도 이 원으로 이탈 판정/지도 표시가 된다
  baseLat: number | null;
  baseLng: number | null;
  radius: number | null;
  isActive: boolean;
  createdAt: string;
};

export type DemandSiteSchedule = {
  id: number;
  demandSiteId: number;
  groupId: number;
  groupName: string;
  shiftStart: string;
  shiftEnd: string;
};

export type LatLngPoint = { lat: number; lng: number };

export type DemandSiteLocationShape = "RADIUS" | "POLYGON";

export type DemandSiteLocation = {
  id: number;
  demandSiteId: number;
  name: string;
  shapeType: DemandSiteLocationShape;
  baseLat: number | null;
  baseLng: number | null;
  radius: number | null;
  polygon: LatLngPoint[] | null;
  createdAt: string;
};

export type ParticipantStatus = "ACTIVE" | "DROPPED" | "ON_LEAVE";

export type Participant = {
  id: number;
  programId: number;
  groupId: number | null;
  name: string;
  demandName: string | null;
  demandSiteId: number | null;
  birthYear: number | null;
  status: ParticipantStatus;
  droppedAt: string | null;
  dropReason: string | null;
  leaveStart: string | null;
  leaveEnd: string | null;
  educationAmount: number;
  educationType: "add" | "deduct" | "none";
  dementiaAmount: number;
  dementiaType: "add" | "deduct" | "none";
  socialInsuranceEnrolled: boolean;
  weeklyHolidayHours: number;
  createdAt: string;
};

export type Group = {
  id: number;
  programId: number;
  name: string;
  description: string | null;
  shiftStart: string;
  shiftEnd: string;
  isActive: boolean;
  participantCount: number;
  createdAt: string;
};

export type SafetyAlert = {
  alertId: string;
  message: string;
  region: string | null;
  alertType: string | null;
  source: "MOIS" | "MANUAL";
  sentAt: string;
  targetCount: number;
  successCount: number;
  failCount: number;
};

export type ProgramWithParticipants = Program & { participants: Participant[] };

export type Admin = {
  id: number;
  email: string;
  name: string | null;
  role: Role;
  organizationId: number | null;
  programIds: number[];
  groupIds: number[];
  isActive: boolean;
  createdAt: string;
};

export type AttendanceStatus = "NORMAL" | "LATE" | "EARLY_LEAVE" | "INVALID";

export type AttendanceLog = {
  id: number;
  participantId: number;
  groupId: number | null;
  programId: number;
  workDate: string;
  clockIn: string | null;
  clockOut: string | null;
  totalMinutes: number | null;
  status: AttendanceStatus;
  note: string | null;
  signatureKey: string | null;
  createdAt: string;
  // 출퇴근 버튼을 누른 시점의 위치. 위치 권한을 거부했거나 GPS를 못 잡으면 전부 null이다.
  // inside는 "구역 밖(false)"과 "판정 불가(null: 좌표·수요처·관제구역 없음)"가 다르다.
  // 관제 반경이 최소 1.5km라 inside만으론 자택 출근을 못 걸러내므로 distanceM을 같이 본다.
  clockInLat: number | null;
  clockInLng: number | null;
  clockInAccuracy: number | null;
  clockInInside: boolean | null;
  clockInDistanceM: number | null;
  clockOutLat: number | null;
  clockOutLng: number | null;
  clockOutAccuracy: number | null;
  clockOutInside: boolean | null;
  clockOutDistanceM: number | null;
  // 이 날 받은 좌표 중 위치 조작 앱이 주입한 것으로 표시된 건수(출퇴근 + 근무 중 보고).
  // 하이브리드 앱에서만 채워지고 웹 사용자는 항상 0이므로, 0을 결백으로 읽으면 안 된다.
  simulatedCount: number;
};

export type AttendanceRow = {
  log: AttendanceLog;
  participantName: string;
  groupName: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
};

export type ParticipantAttendanceRow = {
  log: AttendanceLog;
  groupName: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
};

export type AttendanceStats = {
  total: number;
  normal: number;
  late: number;
  earlyLeave: number;
  totalHours: number;
};

export type MonthlyAttendance = {
  logs: AttendanceRow[];
  stats: AttendanceStats;
};

export type ParticipantMonthlyAttendance = {
  logs: ParticipantAttendanceRow[];
  stats: AttendanceStats;
};

export type ParticipantDetail = Participant & {
  programName: string;
  programType: string | null;
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

export type LeaveRow = {
  leave: ParticipantLeave;
  participantName: string;
  groupName: string | null;
  annualTotalDays: number | null;
  annualUsedDays: number | null;
  annualRemainingDays: number | null;
};

export type AnnualLeave = {
  participantId: number;
  year: string;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
};

export type LeaveMonthlyStat = {
  month: string;
  totalLeaves: number;
  paidLeaves: number;
  unpaidLeaves: number;
  totalDays: number;
};

export type LeaveStats = {
  monthly: LeaveMonthlyStat[];
  annual: {
    participants: number;
    totalAnnual: number;
    usedAnnual: number;
    remainingAnnual: number;
  };
};

export type EscapeStatus = "OPEN" | "RESOLVED";

export type EscapeLog = {
  id: number;
  participantId: number;
  programId: number;
  demandSiteId: number | null;
  detectedAt: string;
  lat: number;
  lng: number;
  distanceKm: number;
  alertCount: number;
  status: EscapeStatus;
  alerted: boolean;
  resolvedBy: number | null;
  resolvedAt: string | null;
  memo: string | null;
};

export type EscapeRow = {
  escape: EscapeLog;
  participantName: string;
  groupName: string | null;
  demandSiteName: string | null;
};

export type GroupMonthlySchedule = {
  groupId: number;
  yearMonth: string;
  workDates: string[];
  maxMonthlyMinutes: number;
};

export type ParticipantMonthlySchedule = {
  participantId: number;
  yearMonth: string;
  workDates: string[] | null;
  maxMonthlyMinutes: number | null;
};

export type LiveWorker = {
  participantId: number;
  name: string;
  groupName: string;
  demandSiteId: number | null;
  demandSiteName: string;
  lat: number | null;
  lng: number | null;
  lastLocationAt: string | null;
  alertCount: number;
  status: "NORMAL" | "ESCAPE";
};

export type TrainingCategory = "PRE" | "DURING";
export type TrainingPayMode = "WORK" | "HOURLY" | "DAILY" | "NONE";

export type ProjectTraining = {
  id: number;
  programId: number;
  name: string;
  category: TrainingCategory;
  isPaid: boolean;
  payMode: TrainingPayMode;
  hours: number | null;
  dailyWage: number | null;
  isRequired: boolean;
  isActive: boolean;
  createdAt: string;
};

export type TrainingLogStatus = "COMPLETED" | "CANCELLED";

export type ParticipantTrainingLog = {
  id: number;
  participantId: number;
  trainingId: number;
  attendDate: string;
  attendHours: number;
  payAmount: number;
  status: TrainingLogStatus;
  createdAt: string;
};

export type TrainingLogRow = {
  log: ParticipantTrainingLog;
  participantName: string;
  trainingName: string;
};

export type TrainingSummaryRow = {
  participantId: number;
  participantName: string;
  missingTrainings: { id: number; name: string }[];
};
