import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { applyTestMigrations, TEST_MIGRATIONS } from '$lib/server/db/test-harness';

describe('database migrations', () => {
	it('preserves and backfills attempts created before immutable snapshots', () => {
		const sqlite = new DatabaseSync(':memory:');

		try {
			sqlite.exec('PRAGMA foreign_keys = ON');
			applyTestMigrations(sqlite, TEST_MIGRATIONS.slice(0, 4));
			sqlite.exec(`
				INSERT INTO quizzes
					(public_id, title, mode, level, scaled_total_max, pass_mark_total, status)
				VALUES ('quiz-old', 'Old quiz', 'JLPT_PRACTICE', 'N5', 180, 90, 'PUBLISHED');
				INSERT INTO quiz_scoring_bands
					(quiz_id, code, label, position, scaled_max, pass_mark)
				VALUES (1, 'LANGUAGE_KNOWLEDGE', 'Language', 1, 60, 19);
				INSERT INTO quiz_sections
					(quiz_id, section, position, time_limit_seconds, scoring_band_id)
				VALUES (1, 'VOCAB_KANJI', 1, 30, 1);
				INSERT INTO questions
					(public_id, level, section, stem, explanation, points, status)
				VALUES
					('question-old', 'N5', 'VOCAB_KANJI', 'Original stem', 'Explanation', 2, 'PUBLISHED');
				INSERT INTO question_options (question_id, body, is_correct, position)
				VALUES (1, 'Correct', 1, 1), (1, 'Wrong', 0, 2);
				INSERT INTO attempts (public_id, quiz_id, status, started_at)
				VALUES ('attempt-old', 1, 'IN_PROGRESS', 1000);
				INSERT INTO attempt_questions
					(attempt_id, question_id, section, position, points)
				VALUES (1, 1, 'VOCAB_KANJI', 1, 2);
				INSERT INTO attempt_answers
					(attempt_id, attempt_question_id, question_id, selected_option_id, answered_at)
				VALUES (1, 1, 1, 1, 1001);
			`);

			sqlite.exec('BEGIN');
			applyTestMigrations(sqlite, [TEST_MIGRATIONS[4]]);
			sqlite.exec('COMMIT');

			expect(sqlite.prepare('SELECT count(*) AS count FROM attempt_answers').get()).toEqual({
				count: 1
			});
			expect(
				sqlite
					.prepare(
						`
						SELECT aq.stem, aq.explanation, aq.band_code AS bandCode,
							aqo.body AS selectedOption
						FROM attempt_questions aq
						INNER JOIN attempt_answers aa ON aa.attempt_question_id = aq.id
						INNER JOIN attempt_question_options aqo ON aqo.id = aa.selected_option_id
					`
					)
					.get()
			).toEqual({
				stem: 'Original stem',
				explanation: 'Explanation',
				bandCode: 'LANGUAGE_KNOWLEDGE',
				selectedOption: 'Correct'
			});
			expect(sqlite.prepare('SELECT count(*) AS count FROM attempt_sections').get()).toEqual({
				count: 1
			});
			expect(sqlite.prepare('SELECT count(*) AS count FROM attempt_scoring_bands').get()).toEqual({
				count: 1
			});
			expect(
				sqlite.prepare('SELECT scaled_total_max, pass_mark_total FROM attempts').get()
			).toEqual({
				scaled_total_max: 180,
				pass_mark_total: 90
			});
			expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
		} finally {
			sqlite.close();
		}
	});

	it('upgrades an existing linked quiz and attempt through presentation snapshots', () => {
		const sqlite = new DatabaseSync(':memory:');

		try {
			sqlite.exec('PRAGMA foreign_keys = ON');
			applyTestMigrations(sqlite, TEST_MIGRATIONS.slice(0, 6));
			sqlite.exec(`
				INSERT INTO quizzes
					(id, public_id, title, mode, level, selection_mode, status)
				VALUES (1, 'quiz-linked', 'Linked quiz', 'JLPT_PRACTICE', 'N4', 'FIXED', 'PUBLISHED');
				INSERT INTO quiz_sections (id, quiz_id, section, position)
				VALUES (1, 1, 'GRAMMAR_READING', 1);
				INSERT INTO question_groups
					(id, public_id, level, section, title, passage_text, status)
				VALUES (1, 'group-linked', 'N4', 'GRAMMAR_READING', 'Passage', 'Body', 'PUBLISHED');
				INSERT INTO questions
					(id, public_id, group_id, group_position, level, section, stem, points, status)
				VALUES (1, 'question-linked', 1, 1, 'N4', 'GRAMMAR_READING', 'Question', 1, 'PUBLISHED');
				INSERT INTO question_options (id, question_id, body, is_correct, position)
				VALUES (1, 1, 'Correct', 1, 1), (2, 1, 'Wrong', 0, 2);
				INSERT INTO quiz_questions
					(id, quiz_id, quiz_section_id, question_id, position)
				VALUES (1, 1, 1, 1, 1);
				INSERT INTO attempts (id, public_id, quiz_id, status, started_at)
				VALUES (1, 'attempt-linked', 1, 'IN_PROGRESS', 1000);
				INSERT INTO attempt_questions
					(id, attempt_id, question_id, section, position, points, stem)
				VALUES (1, 1, 1, 'GRAMMAR_READING', 1, 1, 'Frozen question');
				INSERT INTO attempt_question_options
					(id, attempt_id, question_position, position, body, is_correct)
				VALUES (1, 1, 1, 1, 'Correct', 1), (2, 1, 1, 2, 'Wrong', 0);
				INSERT INTO attempt_answers
					(attempt_id, attempt_question_id, question_id, selected_option_id, answered_at)
				VALUES (1, 1, 1, 1, 1001);
			`);

			for (const migration of TEST_MIGRATIONS.slice(6)) {
				sqlite.exec('BEGIN');
				applyTestMigrations(sqlite, [migration]);
				expect(sqlite.prepare('PRAGMA foreign_key_check').all(), migration).toEqual([]);
				sqlite.exec('COMMIT');
			}

			expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
			expect(
				sqlite
					.prepare(
						`SELECT q.format AS questionFormat, qg.format AS groupFormat,
							aq.format AS frozenFormat, a.show_study_aids_during_attempt AS studyAids,
							a.xp_reward AS xpReward, a.xp_awarded AS xpAwarded
						 FROM questions q
						 INNER JOIN question_groups qg ON qg.id = q.group_id
						 INNER JOIN attempt_questions aq ON aq.question_id = q.id
						 INNER JOIN attempts a ON a.id = aq.attempt_id`
					)
					.get()
			).toEqual({
				questionFormat: 'STANDARD',
				groupFormat: 'READING_PASSAGE',
				frozenFormat: 'STANDARD',
				studyAids: 0,
				xpReward: 0,
				xpAwarded: 0
			});
			expect(sqlite.prepare('SELECT count(*) AS count FROM attempt_answers').get()).toEqual({
				count: 1
			});
		} finally {
			sqlite.close();
		}
	});
});
