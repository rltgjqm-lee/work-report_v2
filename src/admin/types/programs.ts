import type { Participant } from "./participants";

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

export type ProgramWithParticipants = Program & { participants: Participant[] };
