ALTER TABLE `admins` ADD COLUMN `name` text;--> statement-breakpoint
ALTER TABLE `admins` ADD COLUMN `is_active` integer DEFAULT true NOT NULL;
