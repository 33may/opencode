CREATE TABLE `augusttask_project` (
	`key` text PRIMARY KEY,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`default_assignee` text,
	`labels` text DEFAULT '[]' NOT NULL,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `augusttask_project_name_idx` ON `augusttask_project` (`name`);--> statement-breakpoint
CREATE INDEX `augusttask_project_status_idx` ON `augusttask_project` (`status`);--> statement-breakpoint
INSERT OR IGNORE INTO `augusttask_project` (`key`, `name`, `description`, `status`, `labels`, `time_created`, `time_updated`)
VALUES ('AUG', 'August', 'Default August project for migrated local tasks.', 'active', '[]', unixepoch('subsec') * 1000, unixepoch('subsec') * 1000);--> statement-breakpoint
CREATE TEMP TABLE `_augusttask_project_migration` AS
WITH `legacy` AS (
  SELECT DISTINCT trim(`project`) AS `name`
  FROM `task_issue`
  WHERE `project` IS NOT NULL AND trim(`project`) != '' AND trim(`project`) != 'AUG'
),
`normalized` AS (
  SELECT
    `name`,
    upper(replace(replace(`name`, '-', '_'), ' ', '_')) AS `normalized`
  FROM `legacy`
),
`ranked` AS (
  SELECT
    `name`,
    `normalized`,
    count(*) OVER (PARTITION BY `normalized`) AS `normalized_count`,
    CASE
      WHEN lower(`name`) = 'august' THEN 0
      WHEN `normalized` GLOB '[A-Z]*' AND `normalized` NOT GLOB '*[^A-Z0-9_]*' AND length(`normalized`) BETWEEN 2 AND 16 AND `normalized` != 'AUG' AND count(*) OVER (PARTITION BY `normalized`) = 1 THEN 0
      ELSE 1
    END AS `needs_legacy_key`
  FROM `normalized`
),
`numbered` AS (
  SELECT
    `name`,
    `normalized`,
    `needs_legacy_key`,
    sum(`needs_legacy_key`) OVER (ORDER BY `name` ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS `legacy_index`
  FROM `ranked`
)
SELECT
  CASE
    WHEN lower(`name`) = 'august' THEN 'AUG'
    WHEN `needs_legacy_key` = 0 THEN `normalized`
    ELSE 'LEGACY_' || `legacy_index`
  END AS `key`,
  `name`
FROM `numbered`;--> statement-breakpoint
UPDATE `task_issue`
SET `project` = 'AUG'
WHERE `project` IS NULL OR trim(`project`) = '';--> statement-breakpoint
UPDATE `task_issue`
SET `project` = (SELECT `key` FROM `_augusttask_project_migration` WHERE `name` = trim(`task_issue`.`project`))
WHERE `project` IS NOT NULL AND trim(`project`) != '' AND trim(`project`) != 'AUG';--> statement-breakpoint
INSERT OR IGNORE INTO `augusttask_project` (`key`, `name`, `description`, `status`, `labels`, `time_created`, `time_updated`)
SELECT `key`, `name`, 'Migrated from existing task_issue.project.', 'active', '[]', unixepoch('subsec') * 1000, unixepoch('subsec') * 1000
FROM `_augusttask_project_migration`
WHERE `key` != 'AUG';--> statement-breakpoint
INSERT INTO `task_counter` (`name`, `value`)
SELECT 'issue:' || `project`, max(max(`sequence`, CASE WHEN `id` GLOB `project` || '-[0-9]*' THEN cast(substr(`id`, length(`project`) + 2) AS integer) ELSE 0 END))
FROM `task_issue`
WHERE `project` GLOB '[A-Z]*' AND `project` NOT GLOB '*[^A-Z0-9_]*' AND length(`project`) BETWEEN 2 AND 16
GROUP BY `project`
ON CONFLICT(`name`) DO UPDATE SET `value` = max(`task_counter`.`value`, excluded.`value`);--> statement-breakpoint
INSERT INTO `task_counter` (`name`, `value`)
SELECT 'event', max(`sequence`)
FROM `task_event`
WHERE `sequence` IS NOT NULL
GROUP BY 1
ON CONFLICT(`name`) DO UPDATE SET `value` = max(`task_counter`.`value`, excluded.`value`);--> statement-breakpoint
INSERT INTO `task_counter` (`name`, `value`)
SELECT 'comment', max(`sequence`)
FROM `task_comment`
WHERE `sequence` IS NOT NULL
GROUP BY 1
ON CONFLICT(`name`) DO UPDATE SET `value` = max(`task_counter`.`value`, excluded.`value`);--> statement-breakpoint
INSERT INTO `task_counter` (`name`, `value`)
SELECT 'relation', max(`sequence`)
FROM `task_relation`
WHERE `sequence` IS NOT NULL
GROUP BY 1
ON CONFLICT(`name`) DO UPDATE SET `value` = max(`task_counter`.`value`, excluded.`value`);--> statement-breakpoint
DROP TABLE `_augusttask_project_migration`;--> statement-breakpoint
DROP INDEX `task_issue_sequence_idx`;--> statement-breakpoint
CREATE INDEX `task_issue_sequence_idx` ON `task_issue` (`sequence`);
