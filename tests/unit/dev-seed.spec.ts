import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GROUP_FORMATS, QUESTION_FORMATS, QUIZ_MODES, SELECTION_MODES } from '$lib/domain/enums';
import { applyTestMigrations } from '$lib/server/db/test-harness';

const DEV_SEED = readFileSync('seeds/dev.sql', 'utf8');

function values(
	sqlite: DatabaseSync,
	query: string,
	column: string,
	...parameters: string[]
): string[] {
	return (sqlite.prepare(query).all(...parameters) as Record<string, string>[])
		.map((row) => row[column])
		.sort();
}

describe('development seed', () => {
	let sqlite: DatabaseSync;

	beforeEach(() => {
		sqlite = new DatabaseSync(':memory:');
		sqlite.exec('PRAGMA foreign_keys = ON');
		applyTestMigrations(sqlite);
	});

	afterEach(() => sqlite.close());

	it('is idempotent and keeps all references valid', () => {
		sqlite.exec(DEV_SEED);
		expect(() => sqlite.exec(DEV_SEED)).not.toThrow();
		expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
	});

	it('publishes every quiz mode and selection mode', () => {
		sqlite.exec(DEV_SEED);

		expect(
			values(sqlite, "SELECT DISTINCT mode FROM quizzes WHERE status = 'PUBLISHED'", 'mode')
		).toEqual([...QUIZ_MODES].sort());
		expect(
			values(
				sqlite,
				"SELECT DISTINCT selection_mode FROM quizzes WHERE status = 'PUBLISHED'",
				'selection_mode'
			)
		).toEqual([...SELECTION_MODES].sort());
	});

	it('makes every question and group format available through a published quiz', () => {
		sqlite.exec(DEV_SEED);

		expect(
			values(
				sqlite,
				`SELECT DISTINCT question.format
				 FROM questions question
				 INNER JOIN quiz_questions quiz_question ON quiz_question.question_id = question.id
				 INNER JOIN quizzes quiz ON quiz.id = quiz_question.quiz_id
				 WHERE question.status = 'PUBLISHED' AND quiz.status = 'PUBLISHED'`,
				'format'
			)
		).toEqual([...QUESTION_FORMATS].sort());
		expect(
			values(
				sqlite,
				`SELECT DISTINCT question_group.format
				  FROM question_groups question_group
				  INNER JOIN questions question ON question.group_id = question_group.id
				  INNER JOIN quiz_questions quiz_question ON quiz_question.question_id = question.id
				  INNER JOIN quizzes quiz ON quiz.id = quiz_question.quiz_id
				  WHERE question_group.status = 'PUBLISHED'
				   AND question.status = 'PUBLISHED'
				   AND quiz.status = 'PUBLISHED'`,
				'format'
			)
		).toEqual([...GROUP_FORMATS].sort());
	});

	it('provides one showcase quiz with every presentation plus image and audio', () => {
		sqlite.exec(DEV_SEED);

		const quizId = '01JSEEDQZN4TYPEDECK0000000';
		expect(
			values(
				sqlite,
				`SELECT DISTINCT question.format
				 FROM questions question
				 INNER JOIN quiz_questions quiz_question ON quiz_question.question_id = question.id
				 INNER JOIN quizzes quiz ON quiz.id = quiz_question.quiz_id
				 WHERE quiz.public_id = ?`,
				'format',
				quizId
			)
		).toEqual([...QUESTION_FORMATS].sort());
		expect(
			values(
				sqlite,
				`SELECT DISTINCT question_group.format
				 FROM question_groups question_group
				 INNER JOIN questions question ON question.group_id = question_group.id
				 INNER JOIN quiz_questions quiz_question ON quiz_question.question_id = question.id
				 INNER JOIN quizzes quiz ON quiz.id = quiz_question.quiz_id
				 WHERE quiz.public_id = ?`,
				'format',
				quizId
			)
		).toEqual([...GROUP_FORMATS].sort());
		expect(
			values(
				sqlite,
				`SELECT DISTINCT media.kind
				 FROM quizzes quiz
				 INNER JOIN quiz_questions quiz_question ON quiz_question.quiz_id = quiz.id
				 INNER JOIN questions question ON question.id = quiz_question.question_id
				 LEFT JOIN question_groups question_group ON question_group.id = question.group_id
				 INNER JOIN media_assets media ON media.id IN (
					question.image_media_id,
					question.audio_media_id,
					question_group.image_media_id,
					question_group.audio_media_id
				 )
				 WHERE quiz.public_id = ?`,
				'kind',
				quizId
			)
		).toEqual(['AUDIO', 'IMAGE']);
		expect(
			values(
				sqlite,
				`SELECT DISTINCT media.public_id
					 FROM quizzes quiz
					 INNER JOIN quiz_questions quiz_question ON quiz_question.quiz_id = quiz.id
					 INNER JOIN questions question ON question.id = quiz_question.question_id
					 LEFT JOIN question_groups question_group ON question_group.id = question.group_id
					 INNER JOIN media_assets media ON media.id IN (
						question.image_media_id,
						question.audio_media_id,
						question_group.image_media_id,
						question_group.audio_media_id
					 )
					 WHERE quiz.public_id = ?
					  AND media.public_id IN (
						'01JSEEDASSETJPG00000000000',
						'01JSEEDASSETJPN00000000000'
					  )`,
				'public_id',
				quizId
			)
		).toEqual(['01JSEEDASSETJPG00000000000', '01JSEEDASSETJPN00000000000']);
	});

	it('gives each fixed section questions and each random section a sufficient bank', () => {
		sqlite.exec(DEV_SEED);

		const unusableSections = sqlite
			.prepare(
				`SELECT quiz.public_id AS quizId, quiz_section.section
				  FROM quizzes quiz
				  INNER JOIN quiz_sections quiz_section ON quiz_section.quiz_id = quiz.id
				  WHERE quiz.status = 'PUBLISHED'
				   AND (
				     (quiz.selection_mode = 'FIXED' AND NOT EXISTS (
				       SELECT 1 FROM quiz_questions quiz_question
				       WHERE quiz_question.quiz_section_id = quiz_section.id
				     ))
				     OR
				     (quiz.selection_mode = 'RANDOM' AND (
				       quiz_section.draw_count IS NULL
				       OR quiz_section.draw_count <= 0
				       OR quiz_section.draw_count > (
				         SELECT count(*) FROM questions question
				         WHERE question.level = quiz.level
				           AND question.section = quiz_section.section
				           AND question.status = 'PUBLISHED'
				       )
				     ))
				   )`
			)
			.all();

		expect(unusableSections).toEqual([]);
	});
});
