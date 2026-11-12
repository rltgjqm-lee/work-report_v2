CREATE INDEX `idx_activity_participant_date` ON `activity_logs` (`participant_id`,`act_date`);--> statement-breakpoint
CREATE INDEX `idx_admin_login_history_created` ON `admin_login_history` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_admin_sessions_admin_id` ON `admin_sessions` (`admin_id`);--> statement-breakpoint
CREATE INDEX `idx_attendance_participant_date` ON `attendance_logs` (`participant_id`,`work_date`);--> statement-breakpoint
CREATE INDEX `idx_attendance_program_date` ON `attendance_logs` (`program_id`,`work_date`);--> statement-breakpoint
CREATE INDEX `idx_disaster_push_logs_message` ON `disaster_push_logs` (`message_id`);--> statement-breakpoint
CREATE INDEX `idx_escape_program_status` ON `escape_logs` (`program_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_groups_program` ON `groups` (`program_id`);--> statement-breakpoint
CREATE INDEX `idx_participant_leaves_participant` ON `participant_leaves` (`participant_id`);--> statement-breakpoint
CREATE INDEX `idx_participant_training_participant` ON `participant_training_logs` (`participant_id`);--> statement-breakpoint
CREATE INDEX `idx_participants_program` ON `participants` (`program_id`);--> statement-breakpoint
CREATE INDEX `idx_participants_group` ON `participants` (`group_id`);--> statement-breakpoint
CREATE INDEX `idx_participants_demand_site` ON `participants` (`demand_site_id`);--> statement-breakpoint
CREATE INDEX `idx_push_device_tokens_participant` ON `push_device_tokens` (`participant_id`);--> statement-breakpoint
CREATE INDEX `idx_push_subscriptions_participant` ON `push_subscriptions` (`participant_id`);--> statement-breakpoint
CREATE INDEX `idx_safety_alerts_sent_at` ON `safety_alerts` (`sent_at`);