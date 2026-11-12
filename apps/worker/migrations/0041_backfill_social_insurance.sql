-- Custom SQL migration file, put your code below! --
UPDATE `participants`
SET
  `health_insurance_enrolled` = `social_insurance_enrolled`,
  `longterm_care_insurance_enrolled` = `social_insurance_enrolled`,
  `employment_insurance_enrolled` = `social_insurance_enrolled`,
  `industrial_accident_insurance_enrolled` = `social_insurance_enrolled`
WHERE `social_insurance_enrolled` = 1;
