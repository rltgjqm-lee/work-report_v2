CREATE TABLE `disaster_push_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` integer NOT NULL,
	`message_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`success` integer NOT NULL,
	`sent_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action
);
