CREATE TABLE `clinic` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`email` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `record_links` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`source` text NOT NULL,
	`target` text NOT NULL,
	`relation` text NOT NULL,
	FOREIGN KEY (`source`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_record_links_target` ON `record_links` (`target`);--> statement-breakpoint
CREATE INDEX `idx_record_links_source` ON `record_links` (`source`);