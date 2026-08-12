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
  alertedAtCount: number;
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
