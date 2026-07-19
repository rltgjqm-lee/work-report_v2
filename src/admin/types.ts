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
  role: Role;
  organizationId: number | null;
  programIds: number[];
  groupIds: number[];
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
  educationAmount: number;
  educationType: "add" | "deduct";
  dementiaAmount: number;
  dementiaType: "add" | "deduct";
  healthInsuranceRate: number;
  longtermCareRate: number;
  employmentInsuranceRate: number;
  industrialAccidentRate: number;
  annualLeaveDailyWage: number;
  isActive: boolean;
  createdAt: string;
};

export type DemandSite = {
  id: number;
  programId: number;
  name: string;
  baseLat: number;
  baseLng: number;
  allowedRadius: number;
  address: string | null;
  contactPerson: string | null;
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

export type ParticipantStatus = "ACTIVE" | "DROPPED" | "ON_LEAVE";

export type Participant = {
  id: number;
  programId: number;
  groupId: number | null;
  name: string;
  demandName: string | null;
  phoneLast4: string;
  birthYear: number | null;
  status: ParticipantStatus;
  droppedAt: string | null;
  dropReason: string | null;
  leaveStart: string | null;
  leaveEnd: string | null;
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
