ALTER TABLE `escape_logs` ADD `alerted_at_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `escape_logs` SET `alerted_at_count` = `alert_count` WHERE `alerted` = 1;