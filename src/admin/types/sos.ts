export type SosStatus = "OPEN" | "RESOLVED";

export type SosEvent = {
  id: number;
  participantId: number;
  programId: number;
  demandSiteId: number | null;
  triggeredAt: string;
  lat: number | null;
  lng: number | null;
  escapeStatusAtTrigger: "OUTSIDE" | "INSIDE" | "UNKNOWN";
  status: SosStatus;
  notifiedAt: string | null;
  resolvedBy: number | null;
  resolvedAt: string | null;
  memo: string | null;
};

export type SosRow = {
  sos: SosEvent;
  participantName: string;
  groupName: string | null;
  demandSiteName: string | null;
};
