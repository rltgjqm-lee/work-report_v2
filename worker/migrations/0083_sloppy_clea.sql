CREATE TABLE `participant_leave_accruals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`participant_id` integer NOT NULL,
	`year_month` text NOT NULL,
	`recognized_hours` real NOT NULL,
	`accrued` integer NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participant_leave_accruals_participant_month_unique` ON `participant_leave_accruals` (`participant_id`,`year_month`);--> statement-breakpoint
ALTER TABLE `participants` ADD `hire_date` text;--> statement-breakpoint
ALTER TABLE `programs` ADD `team_leader_allowance` integer DEFAULT 0 NOT NULL;