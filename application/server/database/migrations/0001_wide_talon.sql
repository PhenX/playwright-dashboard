ALTER TABLE `test_runs` ADD `avg_test_duration` integer;--> statement-breakpoint
ALTER TABLE `test_runs` ADD `p90_test_duration` integer;--> statement-breakpoint
ALTER TABLE `test_runs_cases` ADD `steps` text;--> statement-breakpoint
ALTER TABLE `test_runs_cases` ADD `slowest_step` text;--> statement-breakpoint
ALTER TABLE `test_runs_cases` ADD `slowest_step_duration` integer;