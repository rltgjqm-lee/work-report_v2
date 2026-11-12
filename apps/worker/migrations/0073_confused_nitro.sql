CREATE TABLE `group_shift_overrides` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`date` text NOT NULL,
	`shift_start` text NOT NULL,
	`shift_end` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_shift_overrides_group_date_unique` ON `group_shift_overrides` (`group_id`,`date`);