-- organizations: 지역/기관유형/사업연도 추가 (4장)
ALTER TABLE `organizations` ADD `region_sido` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `region_sigungu` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `agency_type` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `prj_year` text;--> statement-breakpoint

-- programs: 급여/4대보험 필드 추가, 지역 필드는 organizations로 이동 (4·5·11장)
ALTER TABLE `programs` ADD `project_type` text;--> statement-breakpoint
ALTER TABLE `programs` ADD `hourly_wage` integer DEFAULT 3000 NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` ADD `education_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` ADD `education_type` text DEFAULT 'add' NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` ADD `dementia_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` ADD `dementia_type` text DEFAULT 'deduct' NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` ADD `health_insurance_rate` real DEFAULT 3.545 NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` ADD `longterm_care_rate` real DEFAULT 12.27 NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` ADD `employment_insurance_rate` real DEFAULT 0.9 NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` ADD `industrial_accident_rate` real DEFAULT 1.5 NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` ADD `annual_leave_daily_wage` integer DEFAULT 31710 NOT NULL;--> statement-breakpoint
ALTER TABLE `programs` DROP COLUMN `region_sido`;--> statement-breakpoint
ALTER TABLE `programs` DROP COLUMN `region_sigungu`;--> statement-breakpoint

-- groups: 신규 (6장)
CREATE TABLE `groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`shift_start` text NOT NULL,
	`shift_end` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

-- participants: 조 배정 + 생애주기 필드 추가 (6·9장)
ALTER TABLE `participants` ADD `group_id` integer REFERENCES groups(id);--> statement-breakpoint
ALTER TABLE `participants` ADD `birth_year` integer;--> statement-breakpoint
ALTER TABLE `participants` ADD `status` text DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE `participants` ADD `dropped_at` text;--> statement-breakpoint
ALTER TABLE `participants` ADD `drop_reason` text;--> statement-breakpoint
ALTER TABLE `participants` ADD `leave_start` text;--> statement-breakpoint
ALTER TABLE `participants` ADD `leave_end` text;--> statement-breakpoint

-- participant_leaves: 휴무 이력 (9장)
CREATE TABLE `participant_leaves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`participant_id` integer NOT NULL,
	`leave_start` text NOT NULL,
	`leave_end` text NOT NULL,
	`reason` text,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

-- admins: Cloudflare Access 전환 — email 기반, 5단계 권한 (2·3장)
-- 주의: 기존 관리자 행은 email이 NULL로 남는다. 실제 배포 전에 각 관리자의
-- Cloudflare Access 허용 이메일로 수동 UPDATE 필요 (username→email 자동 매핑 불가).
ALTER TABLE `admins` ADD `email` text;--> statement-breakpoint
ALTER TABLE `admins` ADD `project_ids` text;--> statement-breakpoint
ALTER TABLE `admins` ADD `group_ids` text;--> statement-breakpoint
DROP INDEX IF EXISTS `admins_username_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `admins_email_unique` ON `admins` (`email`);--> statement-breakpoint
ALTER TABLE `admins` DROP COLUMN `username`;--> statement-breakpoint
ALTER TABLE `admins` DROP COLUMN `password_hash`;--> statement-breakpoint

-- safety_alerts: 재난문자 발송 이력 (관리자 조회용) — processed_disaster_messages 대체 (12장)
CREATE TABLE `safety_alerts` (
	`alert_id` text PRIMARY KEY NOT NULL,
	`message` text NOT NULL,
	`region` text,
	`sent_at` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
DROP TABLE `processed_disaster_messages`;--> statement-breakpoint

-- attendance_logs: 참여자 셀프 출퇴근 체크 (GPS 없음) (11장)
CREATE TABLE `attendance_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`participant_id` integer NOT NULL,
	`group_id` integer,
	`program_id` integer NOT NULL,
	`work_date` text NOT NULL,
	`clock_in` text,
	`clock_out` text,
	`total_minutes` integer,
	`note` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action
);
