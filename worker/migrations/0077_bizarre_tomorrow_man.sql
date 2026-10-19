CREATE TABLE `location_traces` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`participant_id` integer NOT NULL,
	`work_date` text NOT NULL,
	`received_at` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`accuracy_m` real,
	`altitude_m` real,
	`located_at` text,
	`simulated` integer DEFAULT false NOT NULL,
	`judgement` text NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_location_traces_participant_date` ON `location_traces` (`participant_id`,`work_date`);