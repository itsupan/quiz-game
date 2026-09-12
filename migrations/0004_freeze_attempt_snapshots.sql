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
PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
INSERT INTO `__new_attempt_answers`("id", "attempt_id", "attempt_question_id", "question_id", "selected_option_id", "is_correct", "points_earned", "answered_at", "created_at", "updated_at") SELECT "id", "attempt_id", "attempt_question_id", "question_id", "selected_option_id", "is_correct", "points_earned", "answered_at", "created_at", "updated_at" FROM `attempt_answers`;--> statement-breakpoint
DROP TABLE `attempt_answers`;--> statement-breakpoint
ALTER TABLE `__new_attempt_answers` RENAME TO `attempt_answers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_answers_question_idx` ON `attempt_answers` (`attempt_question_id`);--> statement-breakpoint
CREATE INDEX `attempt_answers_attempt_idx` ON `attempt_answers` (`attempt_id`);--> statement-breakpoint
CREATE INDEX `attempt_answers_option_idx` ON `attempt_answers` (`selected_option_id`);--> statement-breakpoint
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
INSERT INTO `__new_attempt_questions`("id", "attempt_id", "question_id", "section", "position", "points", "created_at") SELECT "id", "attempt_id", "question_id", "section", "position", "points", "created_at" FROM `attempt_questions`;--> statement-breakpoint
DROP TABLE `attempt_questions`;--> statement-breakpoint
ALTER TABLE `__new_attempt_questions` RENAME TO `attempt_questions`;--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_questions_attempt_question_idx` ON `attempt_questions` (`attempt_id`,`question_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_questions_attempt_position_idx` ON `attempt_questions` (`attempt_id`,`position`);--> statement-breakpoint
CREATE INDEX `attempt_questions_question_idx` ON `attempt_questions` (`question_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_questions_id_question_idx` ON `attempt_questions` (`id`,`question_id`);--> statement-breakpoint
ALTER TABLE `attempts` ADD `scaled_total_max` integer;--> statement-breakpoint
ALTER TABLE `attempts` ADD `pass_mark_total` integer;