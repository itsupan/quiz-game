import { sql } from 'drizzle-orm';
import {
	check,
	foreignKey,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';

import { users } from './auth';
import { checkIn, createdAt, publicId, updatedAt } from './columns';
import { questions, quizzes } from './content';
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
		/** Makes retried API start requests return the same sitting instead of creating another. */
		idempotencyKey: text('idempotency_key'),
		/** Optimistic concurrency token shared by answer writes and final scoring. */
		revision: integer('revision').notNull().default(0),
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
		/**
		 * Frozen from `quizzes` the instant the attempt starts, so re-scaling a quiz's
		 * scoring later cannot change how an already-running or already-scored attempt is
		 * graded. Null has the same meaning here as on `quizzes`: not scaled-scored.
		 */
		scaledTotalMax: integer('scaled_total_max'),
		passMarkTotal: integer('pass_mark_total'),
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
		uniqueIndex('attempts_user_idempotency_idx')
			.on(table.userId, table.idempotencyKey)
			.where(sql`${table.idempotencyKey} is not null`),
		/** Finds attempts that ran out of time so the server can score and close them. */
		index('attempts_status_expires_idx').on(table.status, table.expiresAt),
		/** Drives the guest purge. */
		index('attempts_guest_purge_idx')
			.on(table.status, table.startedAt)
			.where(sql`${table.userId} is null`)
	]
);

/**
 * What this attempt was actually served, in order — and, frozen alongside it, what that
 * question actually said.
 *
 * Not optional: with a `RANDOM` quiz two learners get different draws, so the server
 * cannot score an attempt unless it remembers which questions it handed out. `section`
 * and `points` were already frozen here before this table also took on `stem`,
 * `explanation`, `bandCode` and the media references — an administrator editing a
 * published question's wording, weight, explanation or scoring band after this row is
 * written must never change what an in-progress or already-scored attempt shows or how
 * it is graded. `questionId` stays for audit/content-linking only; nothing that renders
 * or scores an attempt may join back through it to live content.
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
		/** Which scoring band this question's points fed, at the moment it was served. */
		bandCode: text('band_code', { enum: SCORING_BANDS }),
		stem: text('stem'),
		explanation: text('explanation'),
		imagePublicId: text('image_public_id'),
		imageAltText: text('image_alt_text'),
		audioPublicId: text('audio_public_id'),
		audioTranscript: text('audio_transcript'),
		createdAt: createdAt()
	},
	(table) => [
		check('attempt_questions_section_check', checkIn(table.section, SECTIONS)),
		check('attempt_questions_band_check', checkIn(table.bandCode, SCORING_BANDS)),
		uniqueIndex('attempt_questions_attempt_question_idx').on(table.attemptId, table.questionId),
		uniqueIndex('attempt_questions_attempt_position_idx').on(table.attemptId, table.position),
		// Both unique indexes lead with attempt_id, so nothing indexes question_id and the
		// RESTRICT check on deleting a question would scan every served question ever.
		index('attempt_questions_question_idx').on(table.questionId),
		/** Parent key for attempt_answers' composite FK. */
		uniqueIndex('attempt_questions_id_question_idx').on(table.id, table.questionId)
	]
);

/**
 * The section structure — order and per-section time limit — this attempt was started
 * under, frozen from `quiz_sections` at the same instant `attempt_questions` is written.
 *
 * `sectionDeadlines()` reads this instead of joining `quiz_sections` live, so shortening
 * or reordering a quiz's sections after an attempt has started cannot cut its sitting
 * short or shift a deadline the learner was never shown.
 */
export const attemptSections = sqliteTable(
	'attempt_sections',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		attemptId: integer('attempt_id')
			.notNull()
			.references(() => attempts.id, { onDelete: 'cascade' }),
		section: text('section', { enum: SECTIONS }).notNull(),
		position: integer('position').notNull(),
		timeLimitSeconds: integer('time_limit_seconds'),
		createdAt: createdAt()
	},
	(table) => [
		check('attempt_sections_section_check', checkIn(table.section, SECTIONS)),
		uniqueIndex('attempt_sections_attempt_section_idx').on(table.attemptId, table.section),
		uniqueIndex('attempt_sections_attempt_position_idx').on(table.attemptId, table.position)
	]
);

/**
 * The scoring bands this attempt is graded against, frozen from `quiz_scoring_bands` at
 * the same instant as the rest of the sitting. `attempt_questions.band_code` already
 * records which band each served question feeds, so this table needs no section mapping
 * of its own — just each band's own label and scale, as they stood at start time.
 */
export const attemptScoringBands = sqliteTable(
	'attempt_scoring_bands',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		attemptId: integer('attempt_id')
			.notNull()
			.references(() => attempts.id, { onDelete: 'cascade' }),
		bandCode: text('band_code', { enum: SCORING_BANDS }).notNull(),
		label: text('label').notNull(),
		scaledMax: integer('scaled_max').notNull(),
		passMark: integer('pass_mark'),
		createdAt: createdAt()
	},
	(table) => [
		check('attempt_scoring_bands_code_check', checkIn(table.bandCode, SCORING_BANDS)),
		uniqueIndex('attempt_scoring_bands_attempt_code_idx').on(table.attemptId, table.bandCode)
	]
);

/**
 * The answer key this attempt was actually served, frozen from `question_options`.
 *
 * Keyed by `(attemptId, questionPosition)` — `attempt_questions.position` — rather than
 * by `attempt_questions.id`, so writing this table needs no autoincrement id fed back
 * from another insert in the same transaction; every value it's keyed on is already
 * known in application code before any row is written. `is_correct` copied here is what
 * makes an attempt's grading immune to a later edit of the live answer key.
 */
export const attemptQuestionOptions = sqliteTable(
	'attempt_question_options',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		attemptId: integer('attempt_id')
			.notNull()
			.references(() => attempts.id, { onDelete: 'cascade' }),
		questionPosition: integer('question_position').notNull(),
		position: integer('position').notNull(),
		body: text('body').notNull(),
		isCorrect: integer('is_correct', { mode: 'boolean' }).notNull().default(false),
		createdAt: createdAt()
	},
	(table) => [
		uniqueIndex('attempt_question_options_attempt_position_idx').on(
			table.attemptId,
			table.questionPosition,
			table.position
		),
		uniqueIndex('attempt_question_options_one_correct_idx')
			.on(table.attemptId, table.questionPosition)
			.where(sql`${table.isCorrect} = 1`),
		/** Parent key for attempt_answers' composite FK. */
		uniqueIndex('attempt_question_options_id_attempt_idx').on(table.id, table.attemptId)
	]
);

/**
 * A learner's answer to one served question, written the moment it is chosen.
 *
 * The unique constraint on `attemptQuestionId` is what makes that an idempotent
 * upsert: changing your mind updates the row instead of appending a second one, so
 * there is never an ordering question about which answer counted.
 *
 * `isCorrect` and `pointsEarned` stay null until scoring, so exactly one place in the
 * codebase decides whether an answer was right.
 */
export const attemptAnswers = sqliteTable(
	'attempt_answers',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		attemptId: integer('attempt_id').notNull(),
		attemptQuestionId: integer('attempt_question_id').notNull(),
		/**
		 * Denormalised from the served question so the composite foreign keys below can
		 * tie the chosen option to the question it actually belongs to.
		 */
		questionId: integer('question_id').notNull(),
		/** Null means the learner explicitly skipped, or ran out of time. */
		selectedOptionId: integer('selected_option_id'),
		isCorrect: integer('is_correct', { mode: 'boolean' }),
		pointsEarned: integer('points_earned'),
		answeredAt: integer('answered_at', { mode: 'timestamp' }).notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		/**
		 * On attempt_question_id ALONE. Pairing it with attempt_id widens the constraint
		 * instead of narrowing it — a served question already belongs to exactly one
		 * attempt, so `(1, 900)` and `(2, 900)` are distinct pairs and both insert,
		 * leaving two answers for one question and double-counting it at scoring.
		 */
		uniqueIndex('attempt_answers_question_idx').on(table.attemptQuestionId),
		/** Now the only index leading with attempt_id, so it earns its keep. */
		index('attempt_answers_attempt_idx').on(table.attemptId),
		index('attempt_answers_option_idx').on(table.selectedOptionId),
		foreignKey({
			name: 'attempt_answers_attempt_fk',
			columns: [table.attemptId],
			foreignColumns: [attempts.id]
		}).onDelete('cascade'),
		/** Pins question_id to whatever this attempt was actually served. */
		foreignKey({
			name: 'attempt_answers_served_fk',
			columns: [table.attemptQuestionId, table.questionId],
			foreignColumns: [attemptQuestions.id, attemptQuestions.questionId]
		}).onDelete('cascade'),
		/**
		 * And pins the chosen option to this same attempt's own frozen answer key, in
		 * `attempt_question_options` rather than the live `question_options` — so a client
		 * can never post an option id belonging to a different attempt (or a stale live-table
		 * id from before the switch to frozen options). Which served *question* the option
		 * belongs to is enforced in application code, the same place that already looks the
		 * option up from `served.options` before saving it. A null selection skips the
		 * check, which is what a skipped question needs.
		 */
		foreignKey({
			name: 'attempt_answers_option_fk',
			columns: [table.selectedOptionId, table.attemptId],
			foreignColumns: [attemptQuestionOptions.id, attemptQuestionOptions.attemptId]
		}).onDelete('restrict')
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
