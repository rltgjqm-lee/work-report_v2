PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_disaster_push_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` integer NOT NULL,
	`message_id` text NOT NULL,
	`channel` text DEFAULT 'web' NOT NULL,
	`endpoint` text,
	`token` text,
	`success` integer NOT NULL,
	`sent_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_disaster_push_logs`("id", "program_id", "message_id", "channel", "endpoint", "token", "success", "sent_at") SELECT "id", "program_id", "message_id", "channel", "endpoint", "token", "success", "sent_at" FROM `disaster_push_logs`;--> statement-breakpoint
DROP TABLE `disaster_push_logs`;--> statement-breakpoint
ALTER TABLE `__new_disaster_push_logs` RENAME TO `disaster_push_logs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_pending_pushes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` integer NOT NULL,
	`message_id` text NOT NULL,
	`channel` text DEFAULT 'web' NOT NULL,
	`endpoint` text,
	`p256dh` text,
	`auth` text,
	`token` text,
	`body` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_pending_pushes`("id", "program_id", "message_id", "channel", "endpoint", "p256dh", "auth", "token", "body", "created_at") SELECT "id", "program_id", "message_id", "channel", "endpoint", "p256dh", "auth", "token", "body", "created_at" FROM `pending_pushes`;--> statement-breakpoint
DROP TABLE `pending_pushes`;--> statement-breakpoint
ALTER TABLE `__new_pending_pushes` RENAME TO `pending_pushes`;