-- projectType/projectIds도 agencyType과 같은 이유로 잘못 붙은 이름 — 엔티티는
-- programs이므로 programType/programIds로 맞춘다.
ALTER TABLE `programs` RENAME COLUMN `project_type` TO `program_type`;
ALTER TABLE `admins` RENAME COLUMN `project_ids` TO `program_ids`;
