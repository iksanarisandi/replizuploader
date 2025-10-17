CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`filename` text NOT NULL,
	`file_size_bytes` integer NOT NULL,
	`mime_type` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`uploaded_at` integer NOT NULL,
	`scheduled_deletion_at` integer NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uploads_filename_unique` ON `uploads` (`filename`);--> statement-breakpoint
CREATE TABLE `user_quotas` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`daily_uploads` integer DEFAULT 0 NOT NULL,
	`monthly_uploads` integer DEFAULT 0 NOT NULL,
	`daily_bytes_used` integer DEFAULT 0 NOT NULL,
	`monthly_bytes_used` integer DEFAULT 0 NOT NULL,
	`last_reset_daily` integer NOT NULL,
	`last_reset_monthly` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_quotas_user_id_unique` ON `user_quotas` (`user_id`);