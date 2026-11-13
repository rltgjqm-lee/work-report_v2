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
  // false면 좌표/반경이 있어도 관제 판정에서 빠진다(다각형 거점만 쓰고 싶은 경우)
  baseAreaEnabled: boolean;
  isActive: boolean;
  createdAt: string;
  // 목록 조회(GET /api/demand-sites?programId=)에서만 조 배정까지 조인해서 내려준다 —
  // 생성/수정 응답에는 없다.
  schedules?: DemandSiteSchedule[];
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
