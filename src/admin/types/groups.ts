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

export type GroupMonthlySchedule = {
  groupId: number;
  yearMonth: string;
  workDates: string[];
  maxMonthlyMinutes: number;
};
