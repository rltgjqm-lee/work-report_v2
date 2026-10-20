CREATE TABLE `client_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`participant_id` integer NOT NULL,
	`kind` text NOT NULL,
	`work_date` text NOT NULL,
	`first_occurred_at` text NOT NULL,
	`last_occurred_at` text NOT NULL,
	`received_at` text NOT NULL,
	`occurrences` integer DEFAULT 1 NOT NULL,
	`message` text NOT NULL,
	`http_status` integer,
	`online` integer,
	`connection_type` text,
	`platform` text,
	`app_version` text,
	`bundle_version` text,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_client_events_participant_date` ON `client_events` (`participant_id`,`work_date`);--> statement-breakpoint
CREATE INDEX `idx_client_events_received` ON `client_events` (`received_at`);