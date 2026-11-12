CREATE TABLE `participant_training_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`participant_id` integer NOT NULL,
	`training_id` integer NOT NULL,
	`attend_date` text NOT NULL,
	`attend_hours` real DEFAULT 0 NOT NULL,
	`pay_amount` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'COMPLETED' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`training_id`) REFERENCES `project_trainings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `project_trainings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` integer NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`is_paid` integer DEFAULT false NOT NULL,
	`pay_mode` text DEFAULT 'NONE' NOT NULL,
	`hours` real,
	`daily_wage` integer,
	`is_required` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action
);
