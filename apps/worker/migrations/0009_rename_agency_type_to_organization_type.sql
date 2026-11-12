-- agencyType는 "통합 설계도" 문서 용어(agency)를 그대로 가져온 실수 — 엔티티는
-- organizations이므로 필드명도 organizationType으로 맞춘다.
ALTER TABLE `organizations` RENAME COLUMN `agency_type` TO `organization_type`;
