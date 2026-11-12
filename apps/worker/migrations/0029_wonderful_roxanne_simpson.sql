ALTER TABLE `attendance_logs` ADD `corrected_by_admin_id` integer REFERENCES admins(id);--> statement-breakpoint
ALTER TABLE `attendance_logs` ADD `corrected_at` text;