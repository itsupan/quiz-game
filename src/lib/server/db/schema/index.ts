/**
 * The full schema, in four modules.
 *
 * `drizzle.config.ts` points at this file, so every table reachable from here is part
 * of the generated migration. A table that is not re-exported here does not exist as
 * far as `pnpm db:generate` is concerned.
 *
 * Design reference:
 *   docs/superpowers/specs/2026-09-07-quiz-game-database-schema-design.md
 * Why it is shaped this way:
 *   docs/decisions/2026-09-07-database-schema-decisions.md
 */

export * from './enums';
export * from './auth';
export * from './content';
export * from './attempts';
export * from './audit';

import type {
	attemptAnswers,
	attemptBandScores,
	attemptQuestions,
	attemptSectionScores,
	attempts
} from './attempts';
import type { auditLogs } from './audit';
import type { oauthAccounts, sessions, users } from './auth';
import type {
	mediaAssets,
	questionGroups,
	questionOptions,
	questions,
	quizQuestions,
	quizScoringBands,
	quizSections,
	quizzes
} from './content';

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type OauthAccount = typeof oauthAccounts.$inferSelect;
export type NewOauthAccount = typeof oauthAccounts.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;

export type QuestionGroup = typeof questionGroups.$inferSelect;
export type NewQuestionGroup = typeof questionGroups.$inferInsert;

export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;

export type QuestionOption = typeof questionOptions.$inferSelect;
export type NewQuestionOption = typeof questionOptions.$inferInsert;

export type Quiz = typeof quizzes.$inferSelect;
export type NewQuiz = typeof quizzes.$inferInsert;

export type QuizScoringBand = typeof quizScoringBands.$inferSelect;
export type NewQuizScoringBand = typeof quizScoringBands.$inferInsert;

export type QuizSection = typeof quizSections.$inferSelect;
export type NewQuizSection = typeof quizSections.$inferInsert;

export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type NewQuizQuestion = typeof quizQuestions.$inferInsert;

export type Attempt = typeof attempts.$inferSelect;
export type NewAttempt = typeof attempts.$inferInsert;

export type AttemptQuestion = typeof attemptQuestions.$inferSelect;
export type NewAttemptQuestion = typeof attemptQuestions.$inferInsert;

export type AttemptAnswer = typeof attemptAnswers.$inferSelect;
export type NewAttemptAnswer = typeof attemptAnswers.$inferInsert;

export type AttemptSectionScore = typeof attemptSectionScores.$inferSelect;
export type NewAttemptSectionScore = typeof attemptSectionScores.$inferInsert;

export type AttemptBandScore = typeof attemptBandScores.$inferSelect;
export type NewAttemptBandScore = typeof attemptBandScores.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

/**
 * The projection a quiz page is allowed to send to the browser.
 *
 * `questionOptions.isCorrect` must never appear in a payload that leaves the server —
 * the acceptance criterion is that answer keys cannot be obtained from the initial
 * quiz-page data. Loading a quiz selects these three columns and nothing more.
 */
export type PublicQuestionOption = Pick<QuestionOption, 'id' | 'body' | 'position'>;
