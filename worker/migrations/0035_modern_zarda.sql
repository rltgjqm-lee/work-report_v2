ALTER TABLE `attendance_logs` ADD `clock_in_lat` real;--> statement-breakpoint
ALTER TABLE `attendance_logs` ADD `clock_in_lng` real;--> statement-breakpoint
ALTER TABLE `attendance_logs` ADD `clock_in_accuracy` real;--> statement-breakpoint
ALTER TABLE `attendance_logs` ADD `clock_in_inside` integer;--> statement-breakpoint
ALTER TABLE `attendance_logs` ADD `clock_in_distance_m` integer;--> statement-breakpoint
ALTER TABLE `attendance_logs` ADD `clock_out_lat` real;--> statement-breakpoint
ALTER TABLE `attendance_logs` ADD `clock_out_lng` real;--> statement-breakpoint
ALTER TABLE `attendance_logs` ADD `clock_out_accuracy` real;--> statement-breakpoint
ALTER TABLE `attendance_logs` ADD `clock_out_inside` integer;--> statement-breakpoint
ALTER TABLE `attendance_logs` ADD `clock_out_distance_m` integer;