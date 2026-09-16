ALTER TABLE `attempt_answers` ADD `elapsed_ms` integer;--> statement-breakpoint
ALTER TABLE `attempts` ADD `mode` text;--> statement-breakpoint
ALTER TABLE `attempts` ADD `current_combo` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `attempts` ADD `best_combo` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `attempts` ADD `bonus_xp_awarded` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Backfill the frozen mode for sittings that predate the column. Hand-added: a data-only
-- statement, so the snapshot still describes the structure accurately and stays a correct
-- diff base for the next generated migration.
UPDATE `attempts` SET `mode` = (SELECT `mode` FROM `quizzes` WHERE `quizzes`.`id` = `attempts`.`quiz_id`) WHERE `mode` IS NULL;
