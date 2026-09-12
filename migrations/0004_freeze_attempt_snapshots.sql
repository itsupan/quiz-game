CREATE TABLE `attempt_question_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` integer NOT NULL,
	`question_position` integer NOT NULL,
	`position` integer NOT NULL,
	`body` text NOT NULL,
	`is_correct` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_question_options_attempt_position_idx` ON `attempt_question_options` (`attempt_id`,`question_position`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_question_options_one_correct_idx` ON `attempt_question_options` (`attempt_id`,`question_position`) WHERE "attempt_question_options"."is_correct" = 1;--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_question_options_id_attempt_idx` ON `attempt_question_options` (`id`,`attempt_id`);--> statement-breakpoint
CREATE TABLE `attempt_scoring_bands` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` integer NOT NULL,
	`band_code` text NOT NULL,
	`label` text NOT NULL,
	`scaled_max` integer NOT NULL,
	`pass_mark` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "attempt_scoring_bands_code_check" CHECK("attempt_scoring_bands"."band_code" in ('LANGUAGE_KNOWLEDGE', 'READING', 'LANGUAGE_KNOWLEDGE_READING', 'LISTENING'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_scoring_bands_attempt_code_idx` ON `attempt_scoring_bands` (`attempt_id`,`band_code`);--> statement-breakpoint
CREATE TABLE `attempt_sections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` integer NOT NULL,
	`section` text NOT NULL,
	`position` integer NOT NULL,
	`time_limit_seconds` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "attempt_sections_section_check" CHECK("attempt_sections"."section" in ('VOCAB_KANJI', 'GRAMMAR_READING', 'LISTENING'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_sections_attempt_section_idx` ON `attempt_sections` (`attempt_id`,`section`);--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_sections_attempt_position_idx` ON `attempt_sections` (`attempt_id`,`position`);--> statement-breakpoint

--> D1 applies this file as one transaction, so foreign_keys=OFF would be ignored.
--> Defer checks while both sides of the attempt question/answer relationship are rebuilt.
PRAGMA defer_foreign_keys = true;--> statement-breakpoint
ALTER TABLE `attempts` ADD `scaled_total_max` integer;--> statement-breakpoint
ALTER TABLE `attempts` ADD `pass_mark_total` integer;--> statement-breakpoint

--> Existing attempts predate snapshots. Freeze the best information still available at
--> migration time so they remain usable instead of loading empty questions and timers.
INSERT INTO `attempt_sections` (`attempt_id`, `section`, `position`, `time_limit_seconds`, `created_at`)
SELECT `attempts`.`id`, `quiz_sections`.`section`, `quiz_sections`.`position`, `quiz_sections`.`time_limit_seconds`, `attempts`.`created_at`
FROM `attempts`
INNER JOIN `quiz_sections` ON `quiz_sections`.`quiz_id` = `attempts`.`quiz_id`;--> statement-breakpoint
INSERT INTO `attempt_scoring_bands` (`attempt_id`, `band_code`, `label`, `scaled_max`, `pass_mark`, `created_at`)
SELECT `attempts`.`id`, `quiz_scoring_bands`.`code`, `quiz_scoring_bands`.`label`, `quiz_scoring_bands`.`scaled_max`, `quiz_scoring_bands`.`pass_mark`, `attempts`.`created_at`
FROM `attempts`
INNER JOIN `quiz_scoring_bands` ON `quiz_scoring_bands`.`quiz_id` = `attempts`.`quiz_id`;--> statement-breakpoint
INSERT INTO `attempt_question_options` (`attempt_id`, `question_position`, `position`, `body`, `is_correct`, `created_at`)
SELECT `attempt_questions`.`attempt_id`, `attempt_questions`.`position`, `question_options`.`position`, `question_options`.`body`, `question_options`.`is_correct`, `attempt_questions`.`created_at`
FROM `attempt_questions`
INNER JOIN `question_options` ON `question_options`.`question_id` = `attempt_questions`.`question_id`;--> statement-breakpoint
UPDATE `attempts`
SET `scaled_total_max` = (SELECT `quizzes`.`scaled_total_max` FROM `quizzes` WHERE `quizzes`.`id` = `attempts`.`quiz_id`),
	`pass_mark_total` = (SELECT `quizzes`.`pass_mark_total` FROM `quizzes` WHERE `quizzes`.`id` = `attempts`.`quiz_id`);--> statement-breakpoint

--> Stage answers without foreign keys before dropping either old table. The selected option
--> id changes from the live option id to this attempt's new frozen option id.
CREATE TABLE `__attempt_answers_snapshot` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` integer NOT NULL,
	`attempt_question_id` integer NOT NULL,
	`question_id` integer NOT NULL,
	`selected_option_id` integer,
	`is_correct` integer,
	`points_earned` integer,
	`answered_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__attempt_answers_snapshot` (`id`, `attempt_id`, `attempt_question_id`, `question_id`, `selected_option_id`, `is_correct`, `points_earned`, `answered_at`, `created_at`, `updated_at`)
SELECT `attempt_answers`.`id`, `attempt_answers`.`attempt_id`, `attempt_answers`.`attempt_question_id`, `attempt_answers`.`question_id`, `attempt_question_options`.`id`, `attempt_answers`.`is_correct`, `attempt_answers`.`points_earned`, `attempt_answers`.`answered_at`, `attempt_answers`.`created_at`, `attempt_answers`.`updated_at`
FROM `attempt_answers`
INNER JOIN `attempt_questions` ON `attempt_questions`.`id` = `attempt_answers`.`attempt_question_id`
LEFT JOIN `question_options` ON `question_options`.`id` = `attempt_answers`.`selected_option_id` AND `question_options`.`question_id` = `attempt_answers`.`question_id`
LEFT JOIN `attempt_question_options` ON `attempt_question_options`.`attempt_id` = `attempt_answers`.`attempt_id` AND `attempt_question_options`.`question_position` = `attempt_questions`.`position` AND `attempt_question_options`.`position` = `question_options`.`position`;--> statement-breakpoint
CREATE TABLE `__new_attempt_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` integer NOT NULL,
	`question_id` integer NOT NULL,
	`section` text NOT NULL,
	`position` integer NOT NULL,
	`points` integer NOT NULL,
	`band_code` text,
	`stem` text,
	`explanation` text,
	`image_public_id` text,
	`image_alt_text` text,
	`audio_public_id` text,
	`audio_transcript` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "attempt_questions_section_check" CHECK("__new_attempt_questions"."section" in ('VOCAB_KANJI', 'GRAMMAR_READING', 'LISTENING')),
	CONSTRAINT "attempt_questions_band_check" CHECK("__new_attempt_questions"."band_code" in ('LANGUAGE_KNOWLEDGE', 'READING', 'LANGUAGE_KNOWLEDGE_READING', 'LISTENING'))
);
--> statement-breakpoint
INSERT INTO `__new_attempt_questions` (`id`, `attempt_id`, `question_id`, `section`, `position`, `points`, `band_code`, `stem`, `explanation`, `image_public_id`, `image_alt_text`, `audio_public_id`, `audio_transcript`, `created_at`)
SELECT `attempt_questions`.`id`, `attempt_questions`.`attempt_id`, `attempt_questions`.`question_id`, `attempt_questions`.`section`, `attempt_questions`.`position`, `attempt_questions`.`points`, `quiz_scoring_bands`.`code`, `questions`.`stem`, `questions`.`explanation`, `image_assets`.`public_id`, `image_assets`.`alt_text`, `audio_assets`.`public_id`, `audio_assets`.`transcript`, `attempt_questions`.`created_at`
FROM `attempt_questions`
INNER JOIN `attempts` ON `attempts`.`id` = `attempt_questions`.`attempt_id`
INNER JOIN `questions` ON `questions`.`id` = `attempt_questions`.`question_id`
LEFT JOIN `quiz_sections` ON `quiz_sections`.`quiz_id` = `attempts`.`quiz_id` AND `quiz_sections`.`section` = `attempt_questions`.`section`
LEFT JOIN `quiz_scoring_bands` ON `quiz_scoring_bands`.`quiz_id` = `attempts`.`quiz_id` AND `quiz_scoring_bands`.`id` = `quiz_sections`.`scoring_band_id`
LEFT JOIN `media_assets` AS `image_assets` ON `image_assets`.`id` = `questions`.`image_media_id`
LEFT JOIN `media_assets` AS `audio_assets` ON `audio_assets`.`id` = `questions`.`audio_media_id`;--> statement-breakpoint
DROP TABLE `attempt_answers`;--> statement-breakpoint
DROP TABLE `attempt_questions`;--> statement-breakpoint
ALTER TABLE `__new_attempt_questions` RENAME TO `attempt_questions`;--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_questions_attempt_question_idx` ON `attempt_questions` (`attempt_id`,`question_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_questions_attempt_position_idx` ON `attempt_questions` (`attempt_id`,`position`);--> statement-breakpoint
CREATE INDEX `attempt_questions_question_idx` ON `attempt_questions` (`question_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_questions_id_question_idx` ON `attempt_questions` (`id`,`question_id`);--> statement-breakpoint
CREATE TABLE `__new_attempt_answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` integer NOT NULL,
	`attempt_question_id` integer NOT NULL,
	`question_id` integer NOT NULL,
	`selected_option_id` integer,
	`is_correct` integer,
	`points_earned` integer,
	`answered_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`attempt_question_id`,`question_id`) REFERENCES `attempt_questions`(`id`,`question_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`selected_option_id`,`attempt_id`) REFERENCES `attempt_question_options`(`id`,`attempt_id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_attempt_answers` (`id`, `attempt_id`, `attempt_question_id`, `question_id`, `selected_option_id`, `is_correct`, `points_earned`, `answered_at`, `created_at`, `updated_at`)
SELECT `id`, `attempt_id`, `attempt_question_id`, `question_id`, `selected_option_id`, `is_correct`, `points_earned`, `answered_at`, `created_at`, `updated_at`
FROM `__attempt_answers_snapshot`;--> statement-breakpoint
DROP TABLE `__attempt_answers_snapshot`;--> statement-breakpoint
ALTER TABLE `__new_attempt_answers` RENAME TO `attempt_answers`;--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_answers_question_idx` ON `attempt_answers` (`attempt_question_id`);--> statement-breakpoint
CREATE INDEX `attempt_answers_attempt_idx` ON `attempt_answers` (`attempt_id`);--> statement-breakpoint
CREATE INDEX `attempt_answers_option_idx` ON `attempt_answers` (`selected_option_id`);
