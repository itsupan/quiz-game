import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import { users } from './auth';
import { checkIn, createdAt, publicId, updatedAt } from './columns';
import { questionOptions, questions, quizzes } from './content';
import { ATTEMPT_STATUS, SCORING_BANDS, SECTIONS } from './enums';

/**
 * One sitting of a quiz.
 *
 * `expiresAt` is computed on the server at start, as `startedAt + timeLimitSeconds`.
 * The countdown in the browser is display only; the server treats `expiresAt` as
 * authoritative, so an attempt that arrives late — or never arrives, because the tab
 * was closed — is still scored from the answers already saved.
 *
 * A guest is `userId IS NULL`. There is no separate flag, so the two cannot disagree
 * about whether an attempt belongs to somebody.
 */
export const attempts = sqliteTable(
	'attempts',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		publicId: publicId(),
		quizId: integer('quiz_id')
			.notNull()
			.references(() => quizzes.id, { onDelete: 'restrict' }),
		/** Null for a signed-out visitor: they can play, but nothing is kept or ranked. */
		userId: integer('user_id').references(() => users.id, { onDelete: 'restrict' }),
		status: text('status', { enum: ATTEMPT_STATUS }).notNull().default('IN_PROGRESS'),
		startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
		expiresAt: integer('expires_at', { mode: 'timestamp' }),
		submittedAt: integer('submitted_at', { mode: 'timestamp' }),
		/** Stored at submit so the leaderboard tie-break never recomputes it. */
		durationMs: integer('duration_ms'),
		rawScore: integer('raw_score'),
		rawMax: integer('raw_max'),
		correctCount: integer('correct_count'),
		questionCount: integer('question_count'),
		scaledTotal: integer('scaled_total'),
		passed: integer('passed', { mode: 'boolean' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		check('attempts_status_check', checkIn(table.status, ATTEMPT_STATUS)),
		/**
		 * The leaderboard index. Its column order *is* the documented tie-breaker chain —
		 * highest score, then shortest time, then earliest completion — and the partial
		 * clause keeps guests and in-flight attempts out of the index entirely rather than
		 * relying on a WHERE somebody can forget to write.
		 */
		index('attempts_leaderboard_idx')
			.on(table.quizId, sql`${table.rawScore} desc`, table.durationMs, table.submittedAt)
			.where(sql`${table.status} = 'SUBMITTED' and ${table.userId} is not null`),
		/** "My history". */
		index('attempts_user_submitted_idx').on(table.userId, sql`${table.submittedAt} desc`),
		/** Finds attempts that ran out of time so the server can score and close them. */
		index('attempts_status_expires_idx').on(table.status, table.expiresAt),
		/** Drives the guest purge. */
		index('attempts_guest_purge_idx')
			.on(table.status, table.startedAt)
			.where(sql`${table.userId} is null`)
	]
);

/**
 * What this attempt was actually served, in order.
 *
 * Not optional: with a `RANDOM` quiz two learners get different draws, so the server
 * cannot score an attempt unless it remembers which questions it handed out. `section`
 * and `points` are frozen here, so section scoring needs no join and a later edit to a
 * question's weight cannot silently rescore history.
 */
export const attemptQuestions = sqliteTable(
	'attempt_questions',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		attemptId: integer('attempt_id')
			.notNull()
			.references(() => attempts.id, { onDelete: 'cascade' }),
		questionId: integer('question_id')
			.notNull()
			.references(() => questions.id, { onDelete: 'restrict' }),
		section: text('section', { enum: SECTIONS }).notNull(),
		position: integer('position').notNull(),
		points: integer('points').notNull(),
		createdAt: createdAt()
	},
	(table) => [
		check('attempt_questions_section_check', checkIn(table.section, SECTIONS)),
		uniqueIndex('attempt_questions_attempt_question_idx').on(table.attemptId, table.questionId),
		uniqueIndex('attempt_questions_attempt_position_idx').on(table.attemptId, table.position)
	]
);

/**
 * A learner's answer to one served question, written the moment it is chosen.
 *
 * The unique constraint on `(attemptId, attemptQuestionId)` is what makes that an
 * idempotent upsert: changing your mind updates the row instead of appending a second
 * one, so there is never an ordering question about which answer counted.
 *
 * `isCorrect` and `pointsEarned` stay null until scoring, so exactly one place in the
 * codebase decides whether an answer was right.
 */
export const attemptAnswers = sqliteTable(
	'attempt_answers',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		attemptId: integer('attempt_id')
			.notNull()
			.references(() => attempts.id, { onDelete: 'cascade' }),
		attemptQuestionId: integer('attempt_question_id')
			.notNull()
			.references(() => attemptQuestions.id, { onDelete: 'cascade' }),
		/** Null means the learner explicitly skipped, or ran out of time. */
		selectedOptionId: integer('selected_option_id').references(() => questionOptions.id, {
			onDelete: 'restrict'
		}),
		isCorrect: integer('is_correct', { mode: 'boolean' }),
		pointsEarned: integer('points_earned'),
		answeredAt: integer('answered_at', { mode: 'timestamp' }).notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('attempt_answers_attempt_question_idx').on(
			table.attemptId,
			table.attemptQuestionId
		),
		index('attempt_answers_attempt_idx').on(table.attemptId)
	]
);

/**
 * Raw performance per content section — "you got 7 of 12 listening questions".
 *
 * This is study feedback, not the reported score: it tells a learner where to work,
 * at the granularity they filter quizzes by. The score the exam would actually report
 * is in `attempt_band_scores`.
 */
export const attemptSectionScores = sqliteTable(
	'attempt_section_scores',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		attemptId: integer('attempt_id')
			.notNull()
			.references(() => attempts.id, { onDelete: 'cascade' }),
		section: text('section', { enum: SECTIONS }).notNull(),
		rawScore: integer('raw_score').notNull(),
		rawMax: integer('raw_max').notNull(),
		correctCount: integer('correct_count').notNull(),
		questionCount: integer('question_count').notNull(),
		createdAt: createdAt()
	},
	(table) => [
		check('attempt_section_scores_section_check', checkIn(table.section, SECTIONS)),
		uniqueIndex('attempt_section_scores_attempt_section_idx').on(table.attemptId, table.section)
	]
);

/**
 * The scaled result per JLPT band, and whether each band cleared its own pass mark.
 *
 * `bandCode` and `passMark` are copied from `quiz_scoring_bands` at scoring time rather
 * than joined, so re-banding a quiz later cannot retroactively change what a learner
 * was told they scored.
 *
 * A learner can clear the overall pass mark and still fail the exam by missing one
 * band's minimum, which is why `passed` lives per band as well as on the attempt.
 */
export const attemptBandScores = sqliteTable(
	'attempt_band_scores',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		attemptId: integer('attempt_id')
			.notNull()
			.references(() => attempts.id, { onDelete: 'cascade' }),
		bandCode: text('band_code', { enum: SCORING_BANDS }).notNull(),
		rawScore: integer('raw_score').notNull(),
		rawMax: integer('raw_max').notNull(),
		scaledScore: integer('scaled_score').notNull(),
		scaledMax: integer('scaled_max').notNull(),
		passMark: integer('pass_mark'),
		passed: integer('passed', { mode: 'boolean' }),
		createdAt: createdAt()
	},
	(table) => [
		check('attempt_band_scores_code_check', checkIn(table.bandCode, SCORING_BANDS)),
		uniqueIndex('attempt_band_scores_attempt_code_idx').on(table.attemptId, table.bandCode)
	]
);
