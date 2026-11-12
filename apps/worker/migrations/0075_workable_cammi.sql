CREATE TABLE `attendance_attempt_failures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`participant_id` integer NOT NULL,
	`kind` text NOT NULL,
	`work_date` text NOT NULL,
	`attempted_at` text NOT NULL,
	`error` text NOT NULL,
	`http_status` integer NOT NULL,
	`lat` real,
	`lng` real,
	`accuracy_m` real,
	`distance_m` integer,
	`location_failure` text,
	`location_elapsed_ms` integer,
	`platform` text,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_attendance_attempt_failures_participant_date` ON `attendance_attempt_failures` (`participant_id`,`work_date`);