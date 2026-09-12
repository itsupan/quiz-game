ALTER TABLE `users` ADD `jlpt_level` text CONSTRAINT "users_jlpt_level_check" CHECK(`jlpt_level` in ('N5', 'N4', 'N3', 'N2', 'N1'));--> statement-breakpoint
CREATE INDEX `users_jlpt_level_idx` ON `users` (`jlpt_level`);
