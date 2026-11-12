DROP INDEX `idx_activity_participant_date`;--> statement-breakpoint
CREATE UNIQUE INDEX `activity_logs_participant_date_unique` ON `activity_logs` (`participant_id`,`act_date`);