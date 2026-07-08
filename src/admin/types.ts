export type Role = "super_admin" | "org_admin";

export type Organization = {
  id: number;
  name: string;
  address: string | null;
  rep: string | null;
  phone: string | null;
  fax: string | null;
  bizNo: string | null;
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
  createdAt: string;
};

export type Participant = {
  id: number;
  programId: number;
  name: string;
  demandName: string | null;
  createdAt: string;
};

export type ProgramWithParticipants = Program & { participants: Participant[] };
