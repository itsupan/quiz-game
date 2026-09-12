CREATE TABLE `attempt_question_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` integer NOT NULL,
	`source_group_id` integer NOT NULL,
	`public_id` text NOT NULL,
	`format` text NOT NULL,
	`title` text,
	`instruction` text,
	`passage_text` text,
	`body_translation` text,
	`example_text` text,
	`example_transliteration` text,
	`example_translation` text,
	`image_public_id` text,
	`image_mime_type` text,
	`image_width` integer,
	`image_height` integer,
	`image_alt_text` text,
	`audio_public_id` text,
	`audio_mime_type` text,
	`audio_duration_ms` integer,
	`audio_transcript` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_group_id`) REFERENCES `question_groups`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "attempt_question_groups_format_check" CHECK("attempt_question_groups"."format" in ('READING_PASSAGE', 'LISTENING_CLIP', 'CONCEPT_REVIEW'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_question_groups_attempt_public_idx` ON `attempt_question_groups` (`attempt_id`,`public_id`);--> statement-breakpoint
CREATE INDEX `attempt_question_groups_source_idx` ON `attempt_question_groups` (`source_group_id`);--> statement-breakpoint

--> attempt_answers references attempt_questions with ON DELETE CASCADE. Preserve it in a
--> keyless staging table before rebuilding the parent, then restore the same constraints.
PRAGMA defer_foreign_keys = true;--> statement-breakpoint
CREATE TABLE `__attempt_answers_presentation_snapshot` (
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
);--> statement-breakpoint
INSERT INTO `__attempt_answers_presentation_snapshot` (`id`, `attempt_id`, `attempt_question_id`, `question_id`, `selected_option_id`, `is_correct`, `points_earned`, `answered_at`, `created_at`, `updated_at`)
SELECT `id`, `attempt_id`, `attempt_question_id`, `question_id`, `selected_option_id`, `is_correct`, `points_earned`, `answered_at`, `created_at`, `updated_at`
FROM `attempt_answers`;--> statement-breakpoint
DROP TABLE `attempt_answers`;--> statement-breakpoint
CREATE TABLE `__new_attempt_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` integer NOT NULL,
	`question_id` integer NOT NULL,
	`section` text NOT NULL,
	`group_public_id` text,
	`position` integer NOT NULL,
	`points` integer NOT NULL,
	`band_code` text,
	`stem` text,
	`explanation` text,
	`format` text DEFAULT 'STANDARD' NOT NULL,
	`prompt_translation` text,
	`focus_text` text,
	`focus_reading` text,
	`context_text` text,
	`context_transliteration` text,
	`image_public_id` text,
	`image_mime_type` text,
	`image_width` integer,
	`image_height` integer,
	`image_alt_text` text,
	`audio_public_id` text,
	`audio_mime_type` text,
	`audio_duration_ms` integer,
	`audio_transcript` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`attempt_id`,`group_public_id`) REFERENCES `attempt_question_groups`(`attempt_id`,`public_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "attempt_questions_section_check" CHECK("__new_attempt_questions"."section" in ('VOCAB_KANJI', 'GRAMMAR_READING', 'LISTENING')),
	CONSTRAINT "attempt_questions_band_check" CHECK("__new_attempt_questions"."band_code" in ('LANGUAGE_KNOWLEDGE', 'READING', 'LANGUAGE_KNOWLEDGE_READING', 'LISTENING')),
	CONSTRAINT "attempt_questions_format_check" CHECK("__new_attempt_questions"."format" in ('STANDARD', 'VOCABULARY_MEANING', 'KANJI_READING', 'GRAMMAR_CLOZE', 'READING_COMPREHENSION', 'LISTENING_COMPREHENSION'))
);
--> statement-breakpoint
INSERT INTO `__new_attempt_questions` (`id`, `attempt_id`, `question_id`, `section`, `group_public_id`, `position`, `points`, `band_code`, `stem`, `explanation`, `format`, `prompt_translation`, `focus_text`, `focus_reading`, `context_text`, `context_transliteration`, `image_public_id`, `image_mime_type`, `image_width`, `image_height`, `image_alt_text`, `audio_public_id`, `audio_mime_type`, `audio_duration_ms`, `audio_transcript`, `created_at`)
SELECT `id`, `attempt_id`, `question_id`, `section`, NULL, `position`, `points`, `band_code`, `stem`, `explanation`, 'STANDARD', NULL, NULL, NULL, NULL, NULL, `image_public_id`, NULL, NULL, NULL, `image_alt_text`, `audio_public_id`, NULL, NULL, `audio_transcript`, `created_at`
FROM `attempt_questions`;--> statement-breakpoint
DROP TABLE `attempt_questions`;--> statement-breakpoint
ALTER TABLE `__new_attempt_questions` RENAME TO `attempt_questions`;--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_questions_attempt_question_idx` ON `attempt_questions` (`attempt_id`,`question_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_questions_attempt_position_idx` ON `attempt_questions` (`attempt_id`,`position`);--> statement-breakpoint
CREATE INDEX `attempt_questions_question_idx` ON `attempt_questions` (`question_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_questions_id_question_idx` ON `attempt_questions` (`id`,`question_id`);--> statement-breakpoint
CREATE TABLE `attempt_answers` (
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
);--> statement-breakpoint
INSERT INTO `attempt_answers` (`id`, `attempt_id`, `attempt_question_id`, `question_id`, `selected_option_id`, `is_correct`, `points_earned`, `answered_at`, `created_at`, `updated_at`)
SELECT `id`, `attempt_id`, `attempt_question_id`, `question_id`, `selected_option_id`, `is_correct`, `points_earned`, `answered_at`, `created_at`, `updated_at`
FROM `__attempt_answers_presentation_snapshot`;--> statement-breakpoint
DROP TABLE `__attempt_answers_presentation_snapshot`;--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_answers_question_idx` ON `attempt_answers` (`attempt_question_id`);--> statement-breakpoint
CREATE INDEX `attempt_answers_attempt_idx` ON `attempt_answers` (`attempt_id`);--> statement-breakpoint
CREATE INDEX `attempt_answers_option_idx` ON `attempt_answers` (`selected_option_id`);--> statement-breakpoint

--> The attempt table is widely referenced with ON DELETE CASCADE, so add fields in
--> place instead of rebuilding it and firing child-row deletion triggers.
ALTER TABLE `attempts` ADD `show_study_aids_during_attempt` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `attempts` ADD `xp_reward` integer DEFAULT 0 NOT NULL CONSTRAINT "attempts_xp_reward_check" CHECK(`xp_reward` >= 0);--> statement-breakpoint
ALTER TABLE `attempts` ADD `xp_awarded` integer DEFAULT 0 NOT NULL CONSTRAINT "attempts_xp_awarded_check" CHECK(`xp_awarded` >= 0);
