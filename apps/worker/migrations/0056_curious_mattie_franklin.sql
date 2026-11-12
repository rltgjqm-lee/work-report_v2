CREATE TABLE `ota_bundles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`version` text NOT NULL,
	`r2_key` text NOT NULL,
	`checksum` text NOT NULL,
	`file_size` integer NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
