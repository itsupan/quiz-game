CREATE TABLE `oauth_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "oauth_accounts_provider_check" CHECK("oauth_accounts"."provider" in ('google'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_accounts_provider_account_idx` ON `oauth_accounts` (`provider`,`provider_account_id`);--> statement-breakpoint
CREATE INDEX `oauth_accounts_user_id_idx` ON `oauth_accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`avatar_url` text,
	`role` text DEFAULT 'USER' NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`last_login_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "users_role_check" CHECK("users"."role" in ('USER', 'ADMIN')),
	CONSTRAINT "users_status_check" CHECK("users"."status" in ('ACTIVE', 'SUSPENDED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_public_id_unique` ON `users` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_created_at_idx` ON `users` (`created_at`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `users_status_idx` ON `users` (`status`);--> statement-breakpoint
CREATE INDEX `users_display_name_idx` ON `users` (`display_name`);--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`kind` text NOT NULL,
	`r2_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`duration_ms` integer,
	`width` integer,
	`height` integer,
	`alt_text` text,
	`transcript` text,
	`original_filename` text,
	`uploaded_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "media_assets_kind_check" CHECK("media_assets"."kind" in ('IMAGE', 'AUDIO'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_assets_public_id_unique` ON `media_assets` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `media_assets_r2_key_unique` ON `media_assets` (`r2_key`);--> statement-breakpoint
CREATE INDEX `media_assets_kind_idx` ON `media_assets` (`kind`);--> statement-breakpoint
CREATE TABLE `question_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`level` text NOT NULL,
	`section` text NOT NULL,
	`title` text,
	`passage_text` text,
	`instruction` text,
	`audio_media_id` integer,
	`image_media_id` integer,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`audio_media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`image_media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "question_groups_level_check" CHECK("question_groups"."level" in ('N5', 'N4', 'N3', 'N2', 'N1')),
	CONSTRAINT "question_groups_section_check" CHECK("question_groups"."section" in ('VOCAB_KANJI', 'GRAMMAR_READING', 'LISTENING')),
	CONSTRAINT "question_groups_status_check" CHECK("question_groups"."status" in ('DRAFT', 'PUBLISHED', 'ARCHIVED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `question_groups_public_id_unique` ON `question_groups` (`public_id`);--> statement-breakpoint
CREATE INDEX `question_groups_level_section_status_idx` ON `question_groups` (`level`,`section`,`status`);--> statement-breakpoint
CREATE TABLE `question_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question_id` integer NOT NULL,
	`body` text NOT NULL,
	`is_correct` integer DEFAULT false NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `question_options_position_idx` ON `question_options` (`question_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `question_options_one_correct_idx` ON `question_options` (`question_id`) WHERE "question_options"."is_correct" = 1;--> statement-breakpoint
CREATE TABLE `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`group_id` integer,
	`group_position` integer,
	`level` text NOT NULL,
	`section` text NOT NULL,
	`stem` text NOT NULL,
	`explanation` text,
	`points` integer DEFAULT 1 NOT NULL,
	`image_media_id` integer,
	`audio_media_id` integer,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `question_groups`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`image_media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`audio_media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "questions_level_check" CHECK("questions"."level" in ('N5', 'N4', 'N3', 'N2', 'N1')),
	CONSTRAINT "questions_section_check" CHECK("questions"."section" in ('VOCAB_KANJI', 'GRAMMAR_READING', 'LISTENING')),
	CONSTRAINT "questions_status_check" CHECK("questions"."status" in ('DRAFT', 'PUBLISHED', 'ARCHIVED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `questions_public_id_unique` ON `questions` (`public_id`);--> statement-breakpoint
CREATE INDEX `questions_level_section_status_idx` ON `questions` (`level`,`section`,`status`);--> statement-breakpoint
CREATE INDEX `questions_group_idx` ON `questions` (`group_id`,`group_position`);--> statement-breakpoint
CREATE TABLE `quiz_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quiz_id` integer NOT NULL,
	`quiz_section_id` integer NOT NULL,
	`question_id` integer NOT NULL,
	`position` integer NOT NULL,
	`points_override` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quiz_section_id`) REFERENCES `quiz_sections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quiz_questions_quiz_question_idx` ON `quiz_questions` (`quiz_id`,`question_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `quiz_questions_section_position_idx` ON `quiz_questions` (`quiz_section_id`,`position`);--> statement-breakpoint
CREATE TABLE `quiz_scoring_bands` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quiz_id` integer NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`position` integer NOT NULL,
	`scaled_max` integer NOT NULL,
	`pass_mark` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "quiz_scoring_bands_code_check" CHECK("quiz_scoring_bands"."code" in ('LANGUAGE_KNOWLEDGE', 'READING', 'LANGUAGE_KNOWLEDGE_READING', 'LISTENING'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quiz_scoring_bands_quiz_code_idx` ON `quiz_scoring_bands` (`quiz_id`,`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `quiz_scoring_bands_quiz_position_idx` ON `quiz_scoring_bands` (`quiz_id`,`position`);--> statement-breakpoint
CREATE TABLE `quiz_sections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quiz_id` integer NOT NULL,
	`section` text NOT NULL,
	`position` integer NOT NULL,
	`time_limit_seconds` integer,
	`draw_count` integer,
	`scoring_band_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scoring_band_id`) REFERENCES `quiz_scoring_bands`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "quiz_sections_section_check" CHECK("quiz_sections"."section" in ('VOCAB_KANJI', 'GRAMMAR_READING', 'LISTENING'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quiz_sections_quiz_section_idx` ON `quiz_sections` (`quiz_id`,`section`);--> statement-breakpoint
CREATE UNIQUE INDEX `quiz_sections_quiz_position_idx` ON `quiz_sections` (`quiz_id`,`position`);--> statement-breakpoint
CREATE INDEX `quiz_sections_section_idx` ON `quiz_sections` (`section`);--> statement-breakpoint
CREATE TABLE `attempt_answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` integer NOT NULL,
	`attempt_question_id` integer NOT NULL,
	`selected_option_id` integer,
	`is_correct` integer,
	`points_earned` integer,
	`answered_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`attempt_question_id`) REFERENCES `attempt_questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`selected_option_id`) REFERENCES `question_options`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_answers_attempt_question_idx` ON `attempt_answers` (`attempt_id`,`attempt_question_id`);--> statement-breakpoint
CREATE INDEX `attempt_answers_attempt_idx` ON `attempt_answers` (`attempt_id`);--> statement-breakpoint
CREATE TABLE `attempt_band_scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` integer NOT NULL,
	`band_code` text NOT NULL,
	`raw_score` integer NOT NULL,
	`raw_max` integer NOT NULL,
	`scaled_score` integer NOT NULL,
	`scaled_max` integer NOT NULL,
	`pass_mark` integer,
	`passed` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "attempt_band_scores_code_check" CHECK("attempt_band_scores"."band_code" in ('LANGUAGE_KNOWLEDGE', 'READING', 'LANGUAGE_KNOWLEDGE_READING', 'LISTENING'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_band_scores_attempt_code_idx` ON `attempt_band_scores` (`attempt_id`,`band_code`);--> statement-breakpoint
CREATE TABLE `attempt_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` integer NOT NULL,
	`question_id` integer NOT NULL,
	`section` text NOT NULL,
	`position` integer NOT NULL,
	`points` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "attempt_questions_section_check" CHECK("attempt_questions"."section" in ('VOCAB_KANJI', 'GRAMMAR_READING', 'LISTENING'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_questions_attempt_question_idx` ON `attempt_questions` (`attempt_id`,`question_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_questions_attempt_position_idx` ON `attempt_questions` (`attempt_id`,`position`);--> statement-breakpoint
CREATE TABLE `attempt_section_scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` integer NOT NULL,
	`section` text NOT NULL,
	`raw_score` integer NOT NULL,
	`raw_max` integer NOT NULL,
	`correct_count` integer NOT NULL,
	`question_count` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "attempt_section_scores_section_check" CHECK("attempt_section_scores"."section" in ('VOCAB_KANJI', 'GRAMMAR_READING', 'LISTENING'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_section_scores_attempt_section_idx` ON `attempt_section_scores` (`attempt_id`,`section`);--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`quiz_id` integer NOT NULL,
	`user_id` integer,
	`status` text DEFAULT 'IN_PROGRESS' NOT NULL,
	`started_at` integer NOT NULL,
	`expires_at` integer,
	`submitted_at` integer,
	`duration_ms` integer,
	`raw_score` integer,
	`raw_max` integer,
	`correct_count` integer,
	`question_count` integer,
	`scaled_total` integer,
	`passed` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "attempts_status_check" CHECK("attempts"."status" in ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'ABANDONED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempts_public_id_unique` ON `attempts` (`public_id`);--> statement-breakpoint
CREATE INDEX `attempts_leaderboard_idx` ON `attempts` (`quiz_id`,"raw_score" desc,`duration_ms`,`submitted_at`) WHERE "attempts"."status" = 'SUBMITTED' and "attempts"."user_id" is not null;--> statement-breakpoint
CREATE INDEX `attempts_user_submitted_idx` ON `attempts` (`user_id`,"submitted_at" desc);--> statement-breakpoint
CREATE INDEX `attempts_status_expires_idx` ON `attempts` (`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `attempts_guest_purge_idx` ON `attempts` (`status`,`started_at`) WHERE "attempts"."user_id" is null;--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_user_id` integer,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	`before_json` text,
	`after_json` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_actor_idx` ON `audit_logs` (`actor_user_id`,`created_at`);--> statement-breakpoint
--> The 0000_init placeholder `quizzes` table (id, title, created_at) is replaced
--> outright rather than copied forward: drizzle-kit generated an INSERT ... SELECT
--> naming columns that table never had, and it holds nothing but dev seed rows.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
DROP TABLE `quizzes`;--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`mode` text NOT NULL,
	`level` text NOT NULL,
	`selection_mode` text DEFAULT 'FIXED' NOT NULL,
	`time_limit_seconds` integer,
	`scaled_total_max` integer,
	`pass_mark_total` integer,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`created_by` integer,
	`published_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "quizzes_mode_check" CHECK("quizzes"."mode" in ('JLPT_PRACTICE', 'MOCK_TEST', 'FULL_EXAM')),
	CONSTRAINT "quizzes_level_check" CHECK("quizzes"."level" in ('N5', 'N4', 'N3', 'N2', 'N1')),
	CONSTRAINT "quizzes_selection_mode_check" CHECK("quizzes"."selection_mode" in ('FIXED', 'RANDOM')),
	CONSTRAINT "quizzes_status_check" CHECK("quizzes"."status" in ('DRAFT', 'PUBLISHED', 'ARCHIVED'))
);
--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `quizzes_public_id_unique` ON `quizzes` (`public_id`);--> statement-breakpoint
CREATE INDEX `quizzes_status_level_mode_idx` ON `quizzes` (`status`,`level`,`mode`);