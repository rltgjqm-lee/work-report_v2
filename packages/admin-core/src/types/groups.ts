export type Group = {
  id: number;
  programId: number;
  name: string;
  description: string | null;
  shiftStart: string;
  shiftEnd: string;
  isActive: boolean;
  participantCount: number;
  leaderId: number | null;
  leaderName: string | null;
  createdAt: string;
};
