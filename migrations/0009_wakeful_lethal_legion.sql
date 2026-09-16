PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`quiz_id` integer NOT NULL,
	`user_id` integer,
	`idempotency_key` text,
	`revision` integer DEFAULT 0 NOT NULL,
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
	`scaled_total_max` integer,
	`pass_mark_total` integer,
	`show_study_aids_during_attempt` integer DEFAULT false NOT NULL,
	`xp_reward` integer DEFAULT 0 NOT NULL,
	`xp_awarded` integer DEFAULT 0 NOT NULL,
	`mode` text,
	`current_combo` integer DEFAULT 0 NOT NULL,
	`best_combo` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "attempts_status_check" CHECK("__new_attempts"."status" in ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'ABANDONED')),
	CONSTRAINT "attempts_mode_check" CHECK("__new_attempts"."mode" in ('JLPT_PRACTICE', 'MOCK_TEST', 'FULL_EXAM')),
	CONSTRAINT "attempts_xp_reward_check" CHECK("__new_attempts"."xp_reward" >= 0),
	CONSTRAINT "attempts_xp_awarded_check" CHECK("__new_attempts"."xp_awarded" >= 0),
	CONSTRAINT "attempts_current_combo_check" CHECK("__new_attempts"."current_combo" >= 0),
	CONSTRAINT "attempts_best_combo_check" CHECK("__new_attempts"."best_combo" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_attempts`("id", "public_id", "quiz_id", "user_id", "idempotency_key", "revision", "status", "started_at", "expires_at", "submitted_at", "duration_ms", "raw_score", "raw_max", "correct_count", "question_count", "scaled_total", "passed", "scaled_total_max", "pass_mark_total", "show_study_aids_during_attempt", "xp_reward", "xp_awarded", "mode", "current_combo", "best_combo", "created_at", "updated_at") SELECT "id", "public_id", "quiz_id", "user_id", "idempotency_key", "revision", "status", "started_at", "expires_at", "submitted_at", "duration_ms", "raw_score", "raw_max", "correct_count", "question_count", "scaled_total", "passed", "scaled_total_max", "pass_mark_total", "show_study_aids_during_attempt", "xp_reward", "xp_awarded", "mode", "current_combo", "best_combo", "created_at", "updated_at" FROM `attempts`;--> statement-breakpoint
DROP TABLE `attempts`;--> statement-breakpoint
ALTER TABLE `__new_attempts` RENAME TO `attempts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `attempts_public_id_unique` ON `attempts` (`public_id`);--> statement-breakpoint
CREATE INDEX `attempts_leaderboard_idx` ON `attempts` (`quiz_id`,"raw_score" desc,`duration_ms`,`submitted_at`) WHERE "attempts"."status" = 'SUBMITTED' and "attempts"."user_id" is not null;--> statement-breakpoint
CREATE INDEX `attempts_user_submitted_idx` ON `attempts` (`user_id`,"submitted_at" desc);--> statement-breakpoint
CREATE UNIQUE INDEX `attempts_user_idempotency_idx` ON `attempts` (`user_id`,`idempotency_key`) WHERE "attempts"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX `attempts_status_expires_idx` ON `attempts` (`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `attempts_guest_purge_idx` ON `attempts` (`status`,`started_at`) WHERE "attempts"."user_id" is null;--> statement-breakpoint
-- Backfill the frozen mode for sittings that predate the column. Hand-added: a data-only
-- statement, so `0009_snapshot.json` still describes the structure accurately and stays a
-- correct diff base for the next generated migration.
UPDATE `attempts` SET `mode` = (SELECT `mode` FROM `quizzes` WHERE `quizzes`.`id` = `attempts`.`quiz_id`) WHERE `mode` IS NULL;
