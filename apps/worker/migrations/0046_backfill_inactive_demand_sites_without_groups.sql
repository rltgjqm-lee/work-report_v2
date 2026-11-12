-- Custom SQL migration file, put your code below! --

-- 조가 하나도 배정 안 된 수요처는 소급 비활성화한다 — 이제부터 조 배정 없이는
-- 활성화할 수 없다는 규칙을 기존 데이터에도 맞춘다.
UPDATE `demand_sites`
SET `is_active` = 0
WHERE `id` NOT IN (SELECT DISTINCT `demand_site_id` FROM `demand_site_schedules`);
