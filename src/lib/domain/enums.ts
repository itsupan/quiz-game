/**
 * Every enum-like value in the schema, in one place.
 *
 * Each set is used twice per column: once as Drizzle's `text({ enum })` so TypeScript
 * rejects a bad value at compile time, and once through `checkIn()` so SQLite rejects
 * one at write time. Neither guarantee is worth much alone — the first is erased at
 * runtime, and the second would not stop a typo reaching a query builder.
 */

/**
 * Content exists for N4 and N3 today. All five levels are allowed so that publishing
 * another level is a data change rather than a migration.
 */
export const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;
export type JlptLevel = (typeof JLPT_LEVELS)[number];

/** The three JLPT sections. `quiz_sections` maps these onto per-level scaled bands. */
export const SECTIONS = ['VOCAB_KANJI', 'GRAMMAR_READING', 'LISTENING'] as const;
export type Section = (typeof SECTIONS)[number];

/**
 * JLPT scoring bands, which are NOT the same thing as `SECTIONS`.
 *
 * `SECTIONS` is the content taxonomy the homepage filters on and questions are tagged
 * with. A band is how the exam actually reports a score, and the grouping changes by
 * level: N1-N3 report language knowledge, reading and listening separately, while
 * N4-N5 combine language knowledge and reading into one 0-120 band. A quiz declares its
 * own bands in `quiz_scoring_bands` and points each section at one.
 */
export const SCORING_BANDS = [
	'LANGUAGE_KNOWLEDGE',
	'READING',
	'LANGUAGE_KNOWLEDGE_READING',
	'LISTENING'
] as const;
export type ScoringBand = (typeof SCORING_BANDS)[number];

export const QUIZ_MODES = ['JLPT_PRACTICE', 'MOCK_TEST', 'FULL_EXAM'] as const;
export type QuizMode = (typeof QUIZ_MODES)[number];

/**
 * `FIXED` quizzes serve the ordered list in `quiz_questions`; `RANDOM` quizzes draw
 * `quiz_sections.draw_count` questions per section from the bank at attempt start.
 */
export const SELECTION_MODES = ['FIXED', 'RANDOM'] as const;
export type SelectionMode = (typeof SELECTION_MODES)[number];

/** Content is archived, never deleted, so past attempts stay readable. */
export const CONTENT_STATUS = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type ContentStatus = (typeof CONTENT_STATUS)[number];

/**
 * `EXPIRED` is set by the server when an attempt passes `expires_at` without being
 * submitted; it is still scored from whatever answers were saved. `ABANDONED` is for
 * attempts reaped without a time limit to expire against.
 */
export const ATTEMPT_STATUS = ['IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'ABANDONED'] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUS)[number];

export const USER_ROLES = ['USER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUS = ['ACTIVE', 'SUSPENDED'] as const;
export type UserStatus = (typeof USER_STATUS)[number];

export const MEDIA_KINDS = ['IMAGE', 'AUDIO'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const OAUTH_PROVIDERS = ['google'] as const;
export type OauthProvider = (typeof OAUTH_PROVIDERS)[number];
