ALTER TABLE `question_groups` ADD `format` text DEFAULT 'READING_PASSAGE' NOT NULL CONSTRAINT "question_groups_format_check" CHECK(`format` in ('READING_PASSAGE', 'LISTENING_CLIP', 'CONCEPT_REVIEW'));--> statement-breakpoint
UPDATE `question_groups` SET `format` = 'LISTENING_CLIP' WHERE `audio_media_id` IS NOT NULL;--> statement-breakpoint
ALTER TABLE `question_groups` ADD `body_translation` text;--> statement-breakpoint
ALTER TABLE `question_groups` ADD `example_text` text;--> statement-breakpoint
ALTER TABLE `question_groups` ADD `example_transliteration` text;--> statement-breakpoint
ALTER TABLE `question_groups` ADD `example_translation` text;--> statement-breakpoint
ALTER TABLE `questions` ADD `format` text DEFAULT 'STANDARD' NOT NULL CONSTRAINT "questions_format_check" CHECK(`format` in ('STANDARD', 'VOCABULARY_MEANING', 'KANJI_READING', 'GRAMMAR_CLOZE', 'READING_COMPREHENSION', 'LISTENING_COMPREHENSION'));--> statement-breakpoint
ALTER TABLE `questions` ADD `prompt_translation` text;--> statement-breakpoint
ALTER TABLE `questions` ADD `focus_text` text;--> statement-breakpoint
ALTER TABLE `questions` ADD `focus_reading` text;--> statement-breakpoint
ALTER TABLE `questions` ADD `context_text` text;--> statement-breakpoint
ALTER TABLE `questions` ADD `context_transliteration` text;--> statement-breakpoint
ALTER TABLE `quizzes` ADD `show_study_aids_during_attempt` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `quizzes` ADD `xp_reward` integer DEFAULT 0 NOT NULL CONSTRAINT "quizzes_xp_reward_check" CHECK(`xp_reward` >= 0);
