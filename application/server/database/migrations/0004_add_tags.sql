CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text NOT NULL,
	`color` text NOT NULL DEFAULT 'neutral',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_text_unique` ON `tags` (`text`);
--> statement-breakpoint
CREATE TABLE `project_tags` (
	`project_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`project_id`, `tag_id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_project_tags_project_id` ON `project_tags` (`project_id`);
--> statement-breakpoint
CREATE INDEX `idx_project_tags_tag_id` ON `project_tags` (`tag_id`);
