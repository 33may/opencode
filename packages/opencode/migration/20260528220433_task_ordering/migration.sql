ALTER TABLE `task_comment` ADD `sequence` integer;--> statement-breakpoint
ALTER TABLE `task_event` ADD `sequence` integer;--> statement-breakpoint
ALTER TABLE `task_relation` ADD `sequence` integer;--> statement-breakpoint
UPDATE `task_comment` SET `sequence` = rowid WHERE `sequence` IS NULL;--> statement-breakpoint
UPDATE `task_event` SET `sequence` = rowid WHERE `sequence` IS NULL;--> statement-breakpoint
UPDATE `task_relation` SET `sequence` = rowid WHERE `sequence` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `task_comment_sequence_idx` ON `task_comment` (`sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `task_event_sequence_idx` ON `task_event` (`sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `task_relation_sequence_idx` ON `task_relation` (`sequence`);
