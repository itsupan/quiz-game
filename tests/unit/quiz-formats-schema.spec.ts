import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { applyTestMigrations, TEST_MIGRATIONS } from '$lib/server/db/test-harness';
import { GROUP_FORMATS, QUESTION_FORMATS } from '$lib/domain/enums';

const PRE_FORMATS_MIGRATIONS = TEST_MIGRATIONS.filter(
	(file) => !file.includes('0006_quiz_formats_and_groups')
);

function legacyDatabase(): DatabaseSync {
	const sqlite = new DatabaseSync(':memory:');
	sqlite.exec('PRAGMA foreign_keys = ON');
	applyTestMigrations(sqlite, PRE_FORMATS_MIGRATIONS);
	return sqlite;
}

describe('0006_quiz_formats_and_groups migration', () => {
	it('backfills existing questions as STANDARD with null presentation fields', () => {
		const sqlite = legacyDatabase();
		sqlite.exec(
			`INSERT INTO questions (id, public_id, level, section, stem, points, status)
			 VALUES (1, '01JSEEDQ000100000000000000', 'N4', 'VOCAB_KANJI', 'stem', 1, 'PUBLISHED')`
		);

		applyTestMigrations(sqlite, ['migrations/0006_quiz_formats_and_groups.sql']);

		const row = sqlite
			.prepare('select format, focus_text, context_text from questions where id = 1')
			.get() as { format: string; focus_text: string | null; context_text: string | null };
		expect(row.format).toBe('STANDARD');
		expect(row.focus_text).toBeNull();
		expect(row.context_text).toBeNull();
		sqlite.close();
	});

	it('backfills existing quizzes with hidden study aids and zero XP', () => {
		const sqlite = legacyDatabase();
		sqlite.exec(
			`INSERT INTO quizzes (id, public_id, title, mode, level, selection_mode, status)
			 VALUES (1, '01JSEEDQUIZ00000000000000', 'title', 'JLPT_PRACTICE', 'N4', 'FIXED', 'PUBLISHED')`
		);

		applyTestMigrations(sqlite, ['migrations/0006_quiz_formats_and_groups.sql']);

		const row = sqlite
			.prepare('select show_study_aids_during_attempt, xp_reward from quizzes where id = 1')
			.get() as { show_study_aids_during_attempt: number; xp_reward: number };
		expect(row.show_study_aids_during_attempt).toBe(0);
		expect(row.xp_reward).toBe(0);
		sqlite.close();
	});

	it('backfills a pre-existing question group as READING_PASSAGE, or LISTENING_CLIP when it has audio', () => {
		const sqlite = legacyDatabase();
		sqlite.exec(
			`INSERT INTO question_groups (id, public_id, level, section, title, passage_text, status)
			 VALUES (1, '01JSEEDGRPRDNG000000000000', 'N3', 'GRAMMAR_READING', 'x', 'passage', 'PUBLISHED')`
		);
		sqlite.exec(
			`INSERT INTO media_assets (id, public_id, kind, r2_key, mime_type, byte_size)
			 VALUES (1, '01JSEEDMEDIAAUDIO000000000', 'AUDIO', 'a.mp3', 'audio/mpeg', 10)`
		);
		sqlite.exec(
			`INSERT INTO question_groups (id, public_id, level, section, title, audio_media_id, status)
			 VALUES (2, '01JSEEDGRPLSTN0000000000000', 'N3', 'LISTENING', 'y', 1, 'PUBLISHED')`
		);

		applyTestMigrations(sqlite, ['migrations/0006_quiz_formats_and_groups.sql']);

		const rows = sqlite.prepare('select id, format from question_groups order by id').all() as {
			id: number;
			format: string;
		}[];
		expect(rows).toEqual([
			{ id: 1, format: 'READING_PASSAGE' },
			{ id: 2, format: 'LISTENING_CLIP' }
		]);
		sqlite.close();
	});
});

describe('format check constraints', () => {
	it('rejects a question with a format outside QUESTION_FORMATS', () => {
		const sqlite = new DatabaseSync(':memory:');
		sqlite.exec('PRAGMA foreign_keys = ON');
		applyTestMigrations(sqlite);
		expect(() =>
			sqlite.exec(
				`INSERT INTO questions (public_id, level, section, format, stem, points, status)
				 VALUES ('01JBADFORMAT0000000000000', 'N4', 'VOCAB_KANJI', 'NOT_A_FORMAT', 'stem', 1, 'DRAFT')`
			)
		).toThrow(/CHECK constraint failed/);
		sqlite.close();
	});

	it('rejects a question group with a format outside GROUP_FORMATS', () => {
		const sqlite = new DatabaseSync(':memory:');
		sqlite.exec('PRAGMA foreign_keys = ON');
		applyTestMigrations(sqlite);
		expect(() =>
			sqlite.exec(
				`INSERT INTO question_groups (public_id, level, section, format, status)
				 VALUES ('01JBADFORMAT0000000000001', 'N4', 'VOCAB_KANJI', 'NOT_A_FORMAT', 'DRAFT')`
			)
		).toThrow(/CHECK constraint failed/);
		sqlite.close();
	});

	it('rejects a negative xpReward', () => {
		const sqlite = new DatabaseSync(':memory:');
		sqlite.exec('PRAGMA foreign_keys = ON');
		applyTestMigrations(sqlite);
		expect(() =>
			sqlite.exec(
				`INSERT INTO quizzes (public_id, title, mode, level, selection_mode, xp_reward)
				 VALUES ('01JBADXP00000000000000000', 'title', 'JLPT_PRACTICE', 'N4', 'FIXED', -1)`
			)
		).toThrow(/CHECK constraint failed/);
		sqlite.close();
	});
});

describe('domain enums', () => {
	it('lists the six question formats from the coverage plan', () => {
		expect(QUESTION_FORMATS).toEqual([
			'STANDARD',
			'VOCABULARY_MEANING',
			'KANJI_READING',
			'GRAMMAR_CLOZE',
			'READING_COMPREHENSION',
			'LISTENING_COMPREHENSION'
		]);
	});

	it('lists the three group formats from the coverage plan', () => {
		expect(GROUP_FORMATS).toEqual(['READING_PASSAGE', 'LISTENING_CLIP', 'CONCEPT_REVIEW']);
	});
});
