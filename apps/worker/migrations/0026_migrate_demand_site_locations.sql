-- 기존 demand_sites.base_lat/base_lng/allowed_radius(단일 원형 거점)를
-- demand_site_locations(수요처당 여러 거점 지원)로 데이터 보존 이관.
-- 다음 마이그레이션에서 demand_sites의 이 3개 컬럼을 제거한다.
INSERT INTO demand_site_locations (demand_site_id, name, shape_type, base_lat, base_lng, radius)
SELECT id, '기본 거점', 'RADIUS', base_lat, base_lng, allowed_radius FROM demand_sites;
