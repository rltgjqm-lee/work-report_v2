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
  // 공익활동 활동대장 엑셀 1행 제목 — 비어있으면 다운로드 시 기본 문구를 쓴다.
  activityLogTitle: string | null;
  isActive: boolean;
  createdAt: string;
};

export type ProgramWithParticipants = Program & {
  organizationName: string | null;
  participants: Participant[];
};

// 목록 화면(사업단 관리)용 — 급여 계산에만 쓰는 보험료율 등은 빼고 화면에 실제로
// 표시하는 필드 + 참여자 수·소속 기관명·담당자명(서버에서 조인)을 담는다.
export type ProgramListItem = Pick<
  Program,
  | "id"
  | "organizationId"
  | "name"
  | "startDate"
  | "endDate"
  | "startTime"
  | "endTime"
  | "programType"
  | "isActive"
> & { participantCount: number; organizationName: string; managerName: string };

// 드롭다운 등 이름만 필요한 곳에서 쓴다.
export type ProgramOption = Pick<Program, "id" | "name">;

// 유형별 필터가 같이 있는 드롭다운에서 쓴다.
export type ProgramFilterOption = Pick<Program, "id" | "name" | "programType">;
