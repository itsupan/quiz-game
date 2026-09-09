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
import {
	CONTENT_STATUS,
	JLPT_LEVELS,
	MEDIA_KINDS,
	QUIZ_MODES,
	SCORING_BANDS,
	SECTIONS,
	SELECTION_MODES
} from './enums';

/**
 * An image or audio file held in R2.
 *
 * D1 stores only validated metadata and the R2 key; the bytes are served through a
 * Worker route from a private bucket, so no public bucket URL is ever persisted.
 *
 * `altText` and `transcript` describe the asset rather than any one question, so they
 * live here and are reused wherever the asset is attached. An `IMAGE` needs non-empty
 * `altText` before its question can be published — enforced in application code, since
 * "meaningful" is not something a constraint can judge.
 */
export const mediaAssets = sqliteTable(
	'media_assets',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		publicId: publicId(),
		kind: text('kind', { enum: MEDIA_KINDS }).notNull(),
		r2Key: text('r2_key').notNull().unique(),
		mimeType: text('mime_type').notNull(),
		byteSize: integer('byte_size').notNull(),
		durationMs: integer('duration_ms'),
		width: integer('width'),
		height: integer('height'),
		altText: text('alt_text'),
		transcript: text('transcript'),
		originalFilename: text('original_filename'),
		uploadedBy: integer('uploaded_by').references(() => users.id, { onDelete: 'restrict' }),
		createdAt: createdAt()
	},
	(table) => [
		check('media_assets_kind_check', checkIn(table.kind, MEDIA_KINDS)),
		index('media_assets_kind_idx').on(table.kind),
		// SQLite indexes no foreign-key child column on its own, so every RESTRICT check
		// on a parent delete is a full scan without these.
		index('media_assets_uploaded_by_idx').on(table.uploadedBy)
	]
);

/**
 * One stimulus shared by several questions — a reading passage, or a listening clip.
 *
 * This is what makes a mock or full exam read like a real JLPT paper instead of a list
 * of disconnected items, and it stores a long passage once rather than once per
 * question hanging off it.
 */
export const questionGroups = sqliteTable(
	'question_groups',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		publicId: publicId(),
		level: text('level', { enum: JLPT_LEVELS }).notNull(),
		section: text('section', { enum: SECTIONS }).notNull(),
		title: text('title'),
		passageText: text('passage_text'),
		instruction: text('instruction'),
		audioMediaId: integer('audio_media_id').references(() => mediaAssets.id, {
			onDelete: 'restrict'
		}),
		imageMediaId: integer('image_media_id').references(() => mediaAssets.id, {
			onDelete: 'restrict'
		}),
		status: text('status', { enum: CONTENT_STATUS }).notNull().default('DRAFT'),
		createdBy: integer('created_by').references(() => users.id, { onDelete: 'restrict' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		check('question_groups_level_check', checkIn(table.level, JLPT_LEVELS)),
		check('question_groups_section_check', checkIn(table.section, SECTIONS)),
		check('question_groups_status_check', checkIn(table.status, CONTENT_STATUS)),
		index('question_groups_level_section_status_idx').on(table.level, table.section, table.status),
		index('question_groups_audio_media_idx').on(table.audioMediaId),
		index('question_groups_image_media_idx').on(table.imageMediaId),
		index('question_groups_created_by_idx').on(table.createdBy)
	]
);

/**
 * A single multiple-choice question in the shared bank.
 *
 * Questions belong to the bank rather than to a quiz, so the same question can appear
 * in a fixed exam and be drawn by a random practice quiz. `groupId` is null for a
 * standalone question and set when it hangs off a shared passage or clip.
 */
export const questions = sqliteTable(
	'questions',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		publicId: publicId(),
		groupId: integer('group_id').references(() => questionGroups.id, { onDelete: 'restrict' }),
		groupPosition: integer('group_position'),
		level: text('level', { enum: JLPT_LEVELS }).notNull(),
		section: text('section', { enum: SECTIONS }).notNull(),
		stem: text('stem').notNull(),
		/** Shown on the result page when reviewing an incorrect answer. */
		explanation: text('explanation'),
		points: integer('points').notNull().default(1),
		imageMediaId: integer('image_media_id').references(() => mediaAssets.id, {
			onDelete: 'restrict'
		}),
		audioMediaId: integer('audio_media_id').references(() => mediaAssets.id, {
			onDelete: 'restrict'
		}),
		status: text('status', { enum: CONTENT_STATUS }).notNull().default('DRAFT'),
		createdBy: integer('created_by').references(() => users.id, { onDelete: 'restrict' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		check('questions_level_check', checkIn(table.level, JLPT_LEVELS)),
		check('questions_section_check', checkIn(table.section, SECTIONS)),
		check('questions_status_check', checkIn(table.status, CONTENT_STATUS)),
		// The draw index for RANDOM quizzes: pick published questions by level and section.
		index('questions_level_section_status_idx').on(table.level, table.section, table.status),
		index('questions_group_idx').on(table.groupId, table.groupPosition),
		index('questions_audio_media_idx').on(table.audioMediaId),
		index('questions_image_media_idx').on(table.imageMediaId),
		index('questions_created_by_idx').on(table.createdBy)
	]
);

/**
 * One answer choice. Exactly one per question is the key.
 *
 * `question_options_one_correct` is a partial unique index, which makes a *second*
 * correct option physically impossible rather than merely rejected by a validator.
 * "At least one" cannot be expressed the same way and stays an application check run
 * when a question is published.
 */
export const questionOptions = sqliteTable(
	'question_options',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		questionId: integer('question_id')
			.notNull()
			.references(() => questions.id, { onDelete: 'cascade' }),
		body: text('body').notNull(),
		isCorrect: integer('is_correct', { mode: 'boolean' }).notNull().default(false),
		position: integer('position').notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('question_options_position_idx').on(table.questionId, table.position),
		uniqueIndex('question_options_one_correct_idx')
			.on(table.questionId)
			.where(sql`${table.isCorrect} = 1`),
		// Parent key for attempt_answers' composite FK, which is what stops an answer
		// selecting an option that belongs to a different question.
		uniqueIndex('question_options_id_question_idx').on(table.id, table.questionId)
	]
);

/**
 * A quiz a learner can start: a practice set, a mock test, or a full exam.
 *
 * `selectionMode` decides where its questions come from — `FIXED` serves the ordered
 * list in `quiz_questions`, `RANDOM` draws from the bank at attempt start using the
 * per-section `draw_count` in `quiz_sections`.
 */
export const quizzes = sqliteTable(
	'quizzes',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		publicId: publicId(),
		title: text('title').notNull(),
		description: text('description'),
		mode: text('mode', { enum: QUIZ_MODES }).notNull(),
		level: text('level', { enum: JLPT_LEVELS }).notNull(),
		selectionMode: text('selection_mode', { enum: SELECTION_MODES }).notNull().default('FIXED'),
		/** Null means untimed. The server, not the client, owns the deadline. */
		timeLimitSeconds: integer('time_limit_seconds'),
		/** 180 for a JLPT paper. Null for quizzes that are not scaled-scored. */
		scaledTotalMax: integer('scaled_total_max'),
		passMarkTotal: integer('pass_mark_total'),
		status: text('status', { enum: CONTENT_STATUS }).notNull().default('DRAFT'),
		createdBy: integer('created_by').references(() => users.id, { onDelete: 'restrict' }),
		publishedAt: integer('published_at', { mode: 'timestamp' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		check('quizzes_mode_check', checkIn(table.mode, QUIZ_MODES)),
		check('quizzes_level_check', checkIn(table.level, JLPT_LEVELS)),
		check('quizzes_selection_mode_check', checkIn(table.selectionMode, SELECTION_MODES)),
		check('quizzes_status_check', checkIn(table.status, CONTENT_STATUS)),
		// The homepage lists published quizzes filtered by level and mode.
		index('quizzes_status_level_mode_idx').on(table.status, table.level, table.mode),
		index('quizzes_created_by_idx').on(table.createdBy)
	]
);

/**
 * How a quiz reports its score.
 *
 * Separate from `quiz_sections` because JLPT bands its score differently per level:
 * an N3 paper reports language knowledge, reading and listening as three 0-60 bands,
 * while an N4 paper combines the first two into one 0-120 band. Both total 180. Several
 * sections can feed one band, so the grouping is data and the scorer needs no
 * level-specific branching.
 *
 * The bands and pass marks are a linear approximation of official JLPT scaling, which
 * is item-response-theory based and unpublished. Results must be presented as an
 * estimate, never as an official score.
 */
export const quizScoringBands = sqliteTable(
	'quiz_scoring_bands',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		quizId: integer('quiz_id')
			.notNull()
			.references(() => quizzes.id, { onDelete: 'cascade' }),
		code: text('code', { enum: SCORING_BANDS }).notNull(),
		/** Display label, e.g. 言語知識（文字・語彙・文法）・読解. */
		label: text('label').notNull(),
		position: integer('position').notNull(),
		scaledMax: integer('scaled_max').notNull(),
		passMark: integer('pass_mark'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		check('quiz_scoring_bands_code_check', checkIn(table.code, SCORING_BANDS)),
		uniqueIndex('quiz_scoring_bands_quiz_code_idx').on(table.quizId, table.code),
		uniqueIndex('quiz_scoring_bands_quiz_position_idx').on(table.quizId, table.position),
		// Parent key for quiz_sections' composite FK: a section may only point at a band
		// belonging to its own quiz.
		uniqueIndex('quiz_scoring_bands_quiz_id_idx').on(table.quizId, table.id)
	]
);

/**
 * A structural part of a quiz: which content section it covers, in what order, with its
 * own optional time limit, and — for a RANDOM quiz — how many questions it draws.
 *
 * Scoring lives one level up, in `quiz_scoring_bands`. An N4 quiz can have separate
 * vocabulary and grammar sections here while both feed a single 0-120 band, which is
 * exactly how the real paper works.
 */
export const quizSections = sqliteTable(
	'quiz_sections',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		quizId: integer('quiz_id')
			.notNull()
			.references(() => quizzes.id, { onDelete: 'cascade' }),
		section: text('section', { enum: SECTIONS }).notNull(),
		position: integer('position').notNull(),
		timeLimitSeconds: integer('time_limit_seconds'),
		/** RANDOM quizzes only: how many questions this section draws from the bank. */
		drawCount: integer('draw_count'),
		/** Which band this section's points feed. Null for quizzes that are not scaled. */
		scoringBandId: integer('scoring_band_id'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		check('quiz_sections_section_check', checkIn(table.section, SECTIONS)),
		uniqueIndex('quiz_sections_quiz_section_idx').on(table.quizId, table.section),
		uniqueIndex('quiz_sections_quiz_position_idx').on(table.quizId, table.position),
		// Homepage filtering by section joins through here.
		index('quiz_sections_section_idx').on(table.section),
		index('quiz_sections_scoring_band_idx').on(table.scoringBandId),
		// Parent key for quiz_questions' composite FK.
		uniqueIndex('quiz_sections_quiz_id_idx').on(table.quizId, table.id),
		/**
		 * Scoped by quiz on purpose. A plain `scoring_band_id -> quiz_scoring_bands(id)`
		 * would happily attach one quiz's section to another quiz's band, and the scorer
		 * would then sum those points into a band whose scaled_max belongs elsewhere.
		 * Null scoring_band_id skips the check, which is what an unscaled quiz needs.
		 */
		foreignKey({
			name: 'quiz_sections_band_fk',
			columns: [table.quizId, table.scoringBandId],
			foreignColumns: [quizScoringBands.quizId, quizScoringBands.id]
		}).onDelete('restrict')
	]
);

/**
 * The ordered question list of a `FIXED` quiz. `RANDOM` quizzes have no rows here —
 * what they served is recorded per attempt in `attempt_questions` instead.
 */
export const quizQuestions = sqliteTable(
	'quiz_questions',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		quizId: integer('quiz_id')
			.notNull()
			.references(() => quizzes.id, { onDelete: 'cascade' }),
		quizSectionId: integer('quiz_section_id').notNull(),
		questionId: integer('question_id')
			.notNull()
			.references(() => questions.id, { onDelete: 'restrict' }),
		position: integer('position').notNull(),
		/** Overrides `questions.points` for this quiz only. */
		pointsOverride: integer('points_override'),
		createdAt: createdAt()
	},
	(table) => [
		uniqueIndex('quiz_questions_quiz_question_idx').on(table.quizId, table.questionId),
		uniqueIndex('quiz_questions_section_position_idx').on(table.quizSectionId, table.position),
		// The leftmost column of every unique index above is quiz_id or quiz_section_id,
		// so the RESTRICT check on deleting a question would otherwise scan this table.
		index('quiz_questions_question_idx').on(table.questionId),
		/** Scoped by quiz: a quiz cannot borrow another quiz's section. */
		foreignKey({
			name: 'quiz_questions_section_fk',
			columns: [table.quizId, table.quizSectionId],
			foreignColumns: [quizSections.quizId, quizSections.id]
		}).onDelete('cascade')
	]
);
