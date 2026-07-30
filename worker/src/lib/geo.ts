// 두 좌표 사이의 직선거리(km) — 이탈 판정에 위경도/반경을 비교할 때 쓴다.
export const haversineKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export interface LatLng {
  lat: number;
  lng: number;
}

// Ray-casting 점-in-다각형 판정. 관제구역처럼 좁은 지역 기준이라 위경도를
// 평면 좌표(lng=x, lat=y)로 취급해도 오차가 무시할 만큼 작다.
export const isPointInPolygon = (point: LatLng, polygon: LatLng[]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};

// 위도 1도당 미터. 경도는 위도가 높아질수록 좁아지므로 cos(위도)를 곱해서 쓴다.
// 관제구역 크기(수백 m~수 km)에선 이 평면 근사의 오차가 무시할 만하다.
const METERS_PER_DEGREE_LAT = 111_320;

// 점에서 선분까지의 최단거리(m). 판정 대상 좌표를 원점에 두고 평면 좌표(m)로 바꿔 계산한다.
const distanceToSegmentM = (
  point: LatLng,
  start: LatLng,
  end: LatLng,
): number => {
  const metersPerDegreeLng =
    METERS_PER_DEGREE_LAT * Math.cos((point.lat * Math.PI) / 180);
  const startX = (start.lng - point.lng) * metersPerDegreeLng;
  const startY = (start.lat - point.lat) * METERS_PER_DEGREE_LAT;
  const endX = (end.lng - point.lng) * metersPerDegreeLng;
  const endY = (end.lat - point.lat) * METERS_PER_DEGREE_LAT;

  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const segmentLengthSquared = segmentX ** 2 + segmentY ** 2;

  // 두 끝점이 겹친 선분이면 그 점까지의 거리로 처리한다
  if (segmentLengthSquared === 0) return Math.hypot(startX, startY);

  // 원점을 선분에 정사영한 뒤 선분 범위(0~1) 안으로 자른다
  const projection = Math.min(
    1,
    Math.max(
      0,
      -(startX * segmentX + startY * segmentY) / segmentLengthSquared,
    ),
  );
  return Math.hypot(
    startX + projection * segmentX,
    startY + projection * segmentY,
  );
};

// 점이 다각형 밖으로 얼마나 나가 있는지(m) — 안에 있으면 0.
// "구역을 벗어난 거리"를 GPS 오차와 비교해 이탈을 단정할 수 있는지 판단하는 데 쓴다.
export const distanceOutsidePolygonM = (
  point: LatLng,
  polygon: LatLng[],
): number => {
  if (polygon.length === 0) return Infinity;
  if (isPointInPolygon(point, polygon)) return 0;

  let shortest = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    shortest = Math.min(
      shortest,
      distanceToSegmentM(point, polygon[j], polygon[i]),
    );
  }
  return shortest;
};

// 다각형의 중심점 — 이탈 로그에 남길 "대략적인 거리" 계산 기준점으로 쓴다
export const polygonCentroid = (polygon: LatLng[]): LatLng => {
  const sum = polygon.reduce(
    (acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }),
    { lat: 0, lng: 0 },
  );
  return { lat: sum.lat / polygon.length, lng: sum.lng / polygon.length };
};
