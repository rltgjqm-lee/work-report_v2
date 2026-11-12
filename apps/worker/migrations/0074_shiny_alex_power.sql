CREATE TABLE `group_leaves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`date` text NOT NULL,
	`leave_type` text NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_leaves_group_date_unique` ON `group_leaves` (`group_id`,`date`);--> statement-breakpoint
ALTER TABLE `participant_leaves` ADD `group_leave_id` integer REFERENCES group_leaves(id);