CREATE TABLE `task_comment` (
	`id` text PRIMARY KEY,
	`issue_id` text NOT NULL,
	`body` text NOT NULL,
	`author` text DEFAULT 'august' NOT NULL,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `fk_task_comment_issue_id_task_issue_id_fk` FOREIGN KEY (`issue_id`) REFERENCES `task_issue`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `task_counter` (
	`name` text PRIMARY KEY,
	`value` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `task_event` (
	`id` text PRIMARY KEY,
	`issue_id` text NOT NULL,
	`action` text NOT NULL,
	`data` text NOT NULL,
	`time_created` integer NOT NULL,
	CONSTRAINT `fk_task_event_issue_id_task_issue_id_fk` FOREIGN KEY (`issue_id`) REFERENCES `task_issue`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `task_issue` (
	`id` text PRIMARY KEY,
	`sequence` integer NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`project` text,
	`labels` text DEFAULT '[]' NOT NULL,
	`assignee` text,
	`delegate` text,
	`parent_id` text,
	`due_date` text,
	`branch` text,
	`source` text DEFAULT 'august' NOT NULL,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	`time_started` integer,
	`time_completed` integer,
	`time_archived` integer
);
--> statement-breakpoint
CREATE TABLE `task_relation` (
	`source_id` text NOT NULL,
	`target_id` text NOT NULL,
	`type` text NOT NULL,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `task_relation_pk` PRIMARY KEY(`source_id`, `target_id`, `type`),
	CONSTRAINT `fk_task_relation_source_id_task_issue_id_fk` FOREIGN KEY (`source_id`) REFERENCES `task_issue`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_task_relation_target_id_task_issue_id_fk` FOREIGN KEY (`target_id`) REFERENCES `task_issue`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `task_comment_issue_idx` ON `task_comment` (`issue_id`);--> statement-breakpoint
CREATE INDEX `task_event_issue_idx` ON `task_event` (`issue_id`,`time_created`);--> statement-breakpoint
CREATE UNIQUE INDEX `task_issue_sequence_idx` ON `task_issue` (`sequence`);--> statement-breakpoint
CREATE INDEX `task_issue_status_idx` ON `task_issue` (`status`);--> statement-breakpoint
CREATE INDEX `task_issue_project_idx` ON `task_issue` (`project`);--> statement-breakpoint
CREATE INDEX `task_issue_parent_idx` ON `task_issue` (`parent_id`);--> statement-breakpoint
CREATE INDEX `task_issue_updated_idx` ON `task_issue` (`time_updated`);--> statement-breakpoint
CREATE INDEX `task_relation_source_idx` ON `task_relation` (`source_id`);--> statement-breakpoint
CREATE INDEX `task_relation_target_idx` ON `task_relation` (`target_id`);