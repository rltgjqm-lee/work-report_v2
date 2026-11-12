CREATE TABLE `demand_site_locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`demand_site_id` integer NOT NULL,
	`name` text NOT NULL,
	`shape_type` text NOT NULL,
	`base_lat` real,
	`base_lng` real,
	`radius` integer,
	`polygon` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`demand_site_id`) REFERENCES `demand_sites`(`id`) ON UPDATE no action ON DELETE no action
);
