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
  // 이탈을 판정한 좌표의 GPS 오차(m)·고도(m)·휴대폰 측위 시각. 예전 기록이나 예전 앱에서
  // 온 좌표는 비어 있다.
  accuracyM: number | null;
  altitudeM: number | null;
  locatedAt: string | null;
  // 좌표 출처 — 안드로이드 1.8+ 앱만 확정적으로 알려주고, 그 외는 null
  locationSource: "GPS" | "NETWORK" | null;
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
  lastAccuracyM: number | null;
  lastLocationSource: "GPS" | "NETWORK" | null;
  lastOutsideM: number | null;
  isJudgementHeld: boolean;
  alertCount: number;
  status: "NORMAL" | "ESCAPE";
};
