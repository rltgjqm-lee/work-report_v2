ALTER TABLE `participants` ADD `education_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `participants` ADD `education_type` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `participants` ADD `dementia_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `participants` ADD `dementia_type` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `participants` ADD `social_insurance_enrolled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `participants` ADD `weekly_holiday_hours` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` DROP COLUMN `education_amount`;--> statement-breakpoint
ALTER TABLE `programs` DROP COLUMN `education_type`;--> statement-breakpoint
ALTER TABLE `programs` DROP COLUMN `dementia_amount`;--> statement-breakpoint
ALTER TABLE `programs` DROP COLUMN `dementia_type`;