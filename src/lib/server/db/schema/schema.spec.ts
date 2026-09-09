import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';

import {
	attemptAnswers,
	attemptBandScores,
	attemptQuestions,
	attemptSectionScores,
	attempts,
	auditLogs,
	mediaAssets,
	oauthAccounts,
	questionGroups,
	questionOptions,
	questions,
	quizQuestions,
	quizScoringBands,
	quizSections,
	quizzes,
	publicQuestionOptionColumns,
	sessions,
	users
} from './index';
import { ATTEMPT_STATUS, JLPT_LEVELS, SCORING_BANDS, SECTIONS } from './enums';

const ALL_TABLES = [
	attemptAnswers,
	attemptBandScores,
	attemptQuestions,
	attemptSectionScores,
	attempts,
	auditLogs,
	mediaAssets,
	oauthAccounts,
	questionGroups,
	questionOptions,
	questions,
	quizQuestions,
	quizScoringBands,
	quizSections,
	quizzes,
	sessions,
	users
];

function columnNames(table: (typeof ALL_TABLES)[number]) {
	return getTableConfig(table).columns.map((column) => column.name);
}

function indexNamed(table: (typeof ALL_TABLES)[number], name: string) {
	return getTableConfig(table).indexes.find((entry) => entry.config.name === name);
}

describe('schema wiring', () => {
	it('maps every table to the snake_case name the migration creates', () => {
		expect(ALL_TABLES.map((table) => getTableConfig(table).name).sort()).toEqual([
			'attempt_answers',
			'attempt_band_scores',
			'attempt_questions',
			'attempt_section_scores',
			'attempts',
			'audit_logs',
			'media_assets',
			'oauth_accounts',
			'question_groups',
			'question_options',
			'questions',
			'quiz_questions',
			'quiz_scoring_bands',
			'quiz_sections',
			'quizzes',
			'sessions',
			'users'
		]);
	});

	it('exposes snake_case columns to SQLite, never camelCase', () => {
		for (const table of ALL_TABLES) {
			for (const name of columnNames(table)) {
				expect(name, `${getTableConfig(table).name}.${name}`).toBe(name.toLowerCase());
			}
		}
	});
});

describe('answer keys', () => {
	it('makes a second correct option impossible via a partial unique index', () => {
		const oneCorrect = indexNamed(questionOptions, 'question_options_one_correct_idx');

		expect(oneCorrect?.config.unique).toBe(true);
		expect(oneCorrect?.config.columns.map((column) => (column as { name: string }).name)).toEqual([
			'question_id'
		]);
		// Without the WHERE clause this would forbid a *second option* rather than a
		// second answer key, which would break every multiple-choice question.
		expect(oneCorrect?.config.where).toBeDefined();
	});

	it('leaves the answer key out of the projection routes send to the browser', () => {
		// The acceptance criterion is that answer keys cannot be read out of the initial
		// quiz-page data, so the allowed columns are a value a load function reuses.
		expect(Object.keys(publicQuestionOptionColumns)).toEqual(['id', 'body', 'position']);
		expect(Object.keys(publicQuestionOptionColumns)).not.toContain('isCorrect');
	});

	it('ties a chosen option to the question it belongs to', () => {
		// Without this composite key a client could post any option id and be scored
		// against an unrelated question's answer key.
		const optionFk = getTableConfig(attemptAnswers).foreignKeys.find(
			(fk) => fk.reference().foreignTable === questionOptions
		);

		expect(optionFk?.reference().columns.map((column) => column.name)).toEqual([
			'selected_option_id',
			'question_id'
		]);
	});
});

describe('leaderboard index', () => {
	const leaderboard = indexNamed(attempts, 'attempts_leaderboard_idx');

	it('orders its columns as the documented tie-breaker chain', () => {
		const columns = leaderboard?.config.columns.map((column) =>
			'name' in column ? (column as { name: string }).name : String(column)
		);

		// quiz, then score, then duration, then completion time.
		expect(columns?.[0]).toBe('quiz_id');
		expect(columns?.at(-2)).toBe('duration_ms');
		expect(columns?.at(-1)).toBe('submitted_at');
	});

	it('excludes guests and in-flight attempts in the index itself', () => {
		expect(leaderboard?.config.where).toBeDefined();
	});
});

describe('attempt integrity', () => {
	it('lets an answer be re-saved idempotently rather than appended', () => {
		const unique = indexNamed(attemptAnswers, 'attempt_answers_question_idx');

		expect(unique?.config.unique).toBe(true);
		// On attempt_question_id ALONE. Adding attempt_id widens the constraint rather
		// than narrowing it, because a served question already belongs to one attempt —
		// so (1, 900) and (2, 900) would both insert and the question scores twice.
		expect(unique?.config.columns.map((column) => (column as { name: string }).name)).toEqual([
			'attempt_question_id'
		]);
	});

	it('scopes a quiz question to a section of its own quiz', () => {
		const sectionFk = getTableConfig(quizQuestions).foreignKeys.find(
			(fk) => fk.reference().foreignTable === quizSections
		);

		expect(sectionFk?.reference().columns.map((column) => column.name)).toEqual([
			'quiz_id',
			'quiz_section_id'
		]);
	});

	it('scopes a section to a scoring band of its own quiz', () => {
		const bandFk = getTableConfig(quizSections).foreignKeys.find(
			(fk) => fk.reference().foreignTable === quizScoringBands
		);

		expect(bandFk?.reference().columns.map((column) => column.name)).toEqual([
			'quiz_id',
			'scoring_band_id'
		]);
	});

	it('allows a guest attempt but never a quiz-less one', () => {
		const columns = getTableConfig(attempts).columns;
		const userId = columns.find((column) => column.name === 'user_id');
		const quizId = columns.find((column) => column.name === 'quiz_id');

		expect(userId?.notNull).toBe(false);
		expect(quizId?.notNull).toBe(true);
	});

	it('freezes section and points onto the served question', () => {
		// Both are copied at attempt start so a later edit cannot rescore history.
		const columns = getTableConfig(attemptQuestions).columns;

		expect(columns.find((column) => column.name === 'section')?.notNull).toBe(true);
		expect(columns.find((column) => column.name === 'points')?.notNull).toBe(true);
	});
});

describe('scoring model', () => {
	it('keeps scaled scoring on bands and raw feedback on sections', () => {
		// Sections are the content taxonomy learners filter by; bands are how JLPT
		// reports a score, and the two group differently per level.
		expect(columnNames(attemptSectionScores)).not.toContain('scaled_score');
		expect(columnNames(attemptBandScores)).toContain('scaled_score');
	});

	it('requires a scaled_max on every band, so a band cannot be half-configured', () => {
		const scaledMax = getTableConfig(quizScoringBands).columns.find(
			(column) => column.name === 'scaled_max'
		);

		expect(scaledMax?.notNull).toBe(true);
	});

	it('lets a section belong to no band, for quizzes that are not scaled', () => {
		const bandId = getTableConfig(quizSections).columns.find(
			(column) => column.name === 'scoring_band_id'
		);

		expect(bandId?.notNull).toBe(false);
	});
});

describe('enum columns', () => {
	it.each([
		[users, 'users_role_check'],
		[questions, 'questions_level_check'],
		[quizzes, 'quizzes_selection_mode_check'],
		[attempts, 'attempts_status_check'],
		[quizScoringBands, 'quiz_scoring_bands_code_check']
	])('constrains %o in SQLite as well as TypeScript', (table, checkName) => {
		const names = getTableConfig(table).checks.map((entry) => entry.name);

		expect(names).toContain(checkName);
	});

	it('keeps the audit log unconstrained so a new action is never dropped', () => {
		expect(getTableConfig(auditLogs).checks).toHaveLength(0);
	});

	it('declares the value sets the checks are built from', () => {
		expect(JLPT_LEVELS).toEqual(['N5', 'N4', 'N3', 'N2', 'N1']);
		expect(SECTIONS).toEqual(['VOCAB_KANJI', 'GRAMMAR_READING', 'LISTENING']);
		expect(ATTEMPT_STATUS).toContain('EXPIRED');
		// N4/N5 combine language knowledge and reading; N1-N3 report them separately.
		expect(SCORING_BANDS).toContain('LANGUAGE_KNOWLEDGE_READING');
		expect(SCORING_BANDS).toContain('READING');
	});
});

describe('foreign keys', () => {
	it('restricts deletion of content that attempts reference', () => {
		// Content is archived, never hard-deleted, so history stays readable.
		const questionFk = getTableConfig(attemptQuestions).foreignKeys.find(
			(fk) => fk.reference().foreignTable === questions
		);

		expect(questionFk?.onDelete).toBe('restrict');
	});

	it('cascades rows that only exist to describe one attempt', () => {
		const attemptFk = getTableConfig(attemptAnswers).foreignKeys.find(
			(fk) => fk.reference().foreignTable === attempts
		);

		expect(attemptFk?.onDelete).toBe('cascade');
	});

	it('links every content table back to a creator for the audit trail', () => {
		for (const table of [questions, questionGroups, quizzes, mediaAssets]) {
			const columns = columnNames(table);

			expect(
				columns.includes('created_by') || columns.includes('uploaded_by'),
				getTableConfig(table).name
			).toBe(true);
		}
	});

	it('ties a session and an oauth identity to a user', () => {
		expect(columnNames(sessions)).toContain('user_id');
		expect(columnNames(oauthAccounts)).toContain('provider_account_id');
	});

	it('scopes a fixed quiz question to both its quiz and its section', () => {
		expect(columnNames(quizQuestions)).toEqual(
			expect.arrayContaining(['quiz_id', 'quiz_section_id', 'question_id', 'position'])
		);
	});
});
