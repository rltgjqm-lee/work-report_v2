ALTER TABLE `participants` ADD `health_insurance_enrolled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `participants` ADD `longterm_care_insurance_enrolled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `participants` ADD `employment_insurance_enrolled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `participants` ADD `industrial_accident_insurance_enrolled` integer DEFAULT false NOT NULL;