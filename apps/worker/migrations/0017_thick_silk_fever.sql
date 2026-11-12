ALTER TABLE `safety_alerts` ADD `alert_type` text;--> statement-breakpoint
ALTER TABLE `safety_alerts` ADD `source` text DEFAULT 'MOIS' NOT NULL;