ALTER TABLE `admins` ADD `role` text DEFAULT 'super_admin' NOT NULL;--> statement-breakpoint
ALTER TABLE `admins` ADD `organization_id` integer REFERENCES organizations(id);