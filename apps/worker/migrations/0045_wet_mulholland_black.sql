CREATE UNIQUE INDEX `demand_site_schedules_site_group_unique` ON `demand_site_schedules` (`demand_site_id`,`group_id`);--> statement-breakpoint
ALTER TABLE `demand_site_schedules` DROP COLUMN `shift_start`;--> statement-breakpoint
ALTER TABLE `demand_site_schedules` DROP COLUMN `shift_end`;