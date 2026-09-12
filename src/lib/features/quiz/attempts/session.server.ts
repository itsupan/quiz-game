import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';

import type { WriteResult } from '$lib/domain/write-result';
import type { Database } from '$lib/server/db';
import {
	attemptAnswers,
	attemptQuestionGroups,
	attemptQuestions,
	attempts,
	attemptSections,
	quizzes
} from '$lib/server/db/schema';
import { isExpired, sectionDeadlines, sectionOpen } from '../timing';
import { loadFrozenOptions } from './questions.server';
import type { AttemptView } from './types.server';

async function loadAttemptGroups(
	db: Database,
	attemptId: number,
	showStudyAidsDuringAttempt: boolean
) {
	const rows = await db
		.select({
			publicId: attemptQuestionGroups.publicId,
			format: attemptQuestionGroups.format,
			title: attemptQuestionGroups.title,
			instruction: attemptQuestionGroups.instruction,
			passageText: attemptQuestionGroups.passageText,
			bodyTranslation: attemptQuestionGroups.bodyTranslation,
			exampleText: attemptQuestionGroups.exampleText,
			exampleTransliteration: attemptQuestionGroups.exampleTransliteration,
			exampleTranslation: attemptQuestionGroups.exampleTranslation,
			imagePublicId: attemptQuestionGroups.imagePublicId,
			imageMimeType: attemptQuestionGroups.imageMimeType,
			imageWidth: attemptQuestionGroups.imageWidth,
			imageHeight: attemptQuestionGroups.imageHeight,
			imageAltText: attemptQuestionGroups.imageAltText,
			audioPublicId: attemptQuestionGroups.audioPublicId,
			audioMimeType: attemptQuestionGroups.audioMimeType,
			audioDurationMs: attemptQuestionGroups.audioDurationMs
		})
		.from(attemptQuestionGroups)
		.where(eq(attemptQuestionGroups.attemptId, attemptId));

	return new Map(
		rows
			.filter((entry) => showStudyAidsDuringAttempt || entry.format !== 'CONCEPT_REVIEW')
			.map((entry) => [
				entry.publicId,
				{
					publicId: entry.publicId,
					format: entry.format,
					title: entry.title,
					instruction: entry.instruction,
					passageText: entry.passageText,
					bodyTranslation: showStudyAidsDuringAttempt ? entry.bodyTranslation : null,
					exampleText: showStudyAidsDuringAttempt ? entry.exampleText : null,
					exampleTransliteration: showStudyAidsDuringAttempt ? entry.exampleTransliteration : null,
					exampleTranslation: showStudyAidsDuringAttempt ? entry.exampleTranslation : null,
					image: entry.imagePublicId
						? {
								publicId: entry.imagePublicId,
								mimeType: entry.imageMimeType,
								width: entry.imageWidth,
								height: entry.imageHeight,
								altText: entry.imageAltText
							}
						: null,
					audio: entry.audioPublicId
						? {
								publicId: entry.audioPublicId,
								mimeType: entry.audioMimeType,
								durationMs: entry.audioDurationMs
							}
						: null
				}
			])
	);
}

export async function loadAttempt(
	db: Database,
	publicId: string,
	userId: number
): Promise<AttemptView | null> {
	const [row] = await db
		.select({
			attemptId: attempts.id,
			attemptPublicId: attempts.publicId,
			userId: attempts.userId,
			status: attempts.status,
			startedAt: attempts.startedAt,
			expiresAt: attempts.expiresAt,
			showStudyAidsDuringAttempt: attempts.showStudyAidsDuringAttempt,
			quizId: quizzes.id,
			quizPublicId: quizzes.publicId,
			title: quizzes.title,
			mode: quizzes.mode,
			level: quizzes.level,
			timeLimitSeconds: quizzes.timeLimitSeconds
		})
		.from(attempts)
		.innerJoin(quizzes, eq(quizzes.id, attempts.quizId))
		.where(and(eq(attempts.publicId, publicId), eq(attempts.userId, userId)));

	if (!row) return null;

	// Frozen at start time: what this attempt's sections actually looked like then, not
	// whatever `quiz_sections` says now.
	const sections = await db
		.select({
			section: attemptSections.section,
			position: attemptSections.position,
			timeLimitSeconds: attemptSections.timeLimitSeconds
		})
		.from(attemptSections)
		.where(eq(attemptSections.attemptId, row.attemptId));

	const served = await db
		.select({
			attemptQuestionId: attemptQuestions.id,
			questionId: attemptQuestions.questionId,
			section: attemptQuestions.section,
			groupPublicId: attemptQuestions.groupPublicId,
			position: attemptQuestions.position,
			points: attemptQuestions.points,
			format: attemptQuestions.format,
			stem: attemptQuestions.stem,
			promptTranslation: attemptQuestions.promptTranslation,
			focusText: attemptQuestions.focusText,
			focusReading: attemptQuestions.focusReading,
			contextText: attemptQuestions.contextText,
			contextTransliteration: attemptQuestions.contextTransliteration,
			imagePublicId: attemptQuestions.imagePublicId,
			imageMimeType: attemptQuestions.imageMimeType,
			imageWidth: attemptQuestions.imageWidth,
			imageHeight: attemptQuestions.imageHeight,
			imageAltText: attemptQuestions.imageAltText,
			audioPublicId: attemptQuestions.audioPublicId,
			audioMimeType: attemptQuestions.audioMimeType,
			audioDurationMs: attemptQuestions.audioDurationMs,
			selectedOptionId: attemptAnswers.selectedOptionId
		})
		.from(attemptQuestions)
		.leftJoin(attemptAnswers, eq(attemptAnswers.attemptQuestionId, attemptQuestions.id))
		.where(eq(attemptQuestions.attemptId, row.attemptId))
		.orderBy(attemptQuestions.position);

	const options = await loadFrozenOptions(db, row.attemptId);
	const groups = await loadAttemptGroups(db, row.attemptId, row.showStudyAidsDuringAttempt);

	return {
		attempt: {
			id: row.attemptId,
			publicId: row.attemptPublicId,
			userId: row.userId,
			status: row.status,
			startedAt: row.startedAt,
			expiresAt: row.expiresAt,
			showStudyAidsDuringAttempt: row.showStudyAidsDuringAttempt
		},
		quiz: {
			id: row.quizId,
			publicId: row.quizPublicId,
			title: row.title,
			mode: row.mode,
			level: row.level,
			timeLimitSeconds: row.timeLimitSeconds
		},
		sectionDeadlines: sectionDeadlines(row.startedAt, row.expiresAt, sections),
		questions: served.map((entry) => ({
			attemptQuestionId: entry.attemptQuestionId,
			questionId: entry.questionId,
			section: entry.section,
			position: entry.position,
			points: entry.points,
			format: entry.format,
			stem: entry.stem ?? '',
			promptTranslation: row.showStudyAidsDuringAttempt ? entry.promptTranslation : null,
			focusText: entry.focusText,
			focusReading: entry.focusReading,
			contextText: entry.contextText,
			contextTransliteration: row.showStudyAidsDuringAttempt ? entry.contextTransliteration : null,
			group: entry.groupPublicId ? (groups.get(entry.groupPublicId) ?? null) : null,
			image: entry.imagePublicId
				? {
						publicId: entry.imagePublicId,
						mimeType: entry.imageMimeType,
						width: entry.imageWidth,
						height: entry.imageHeight,
						altText: entry.imageAltText
					}
				: null,
			audio: entry.audioPublicId
				? {
						publicId: entry.audioPublicId,
						mimeType: entry.audioMimeType,
						durationMs: entry.audioDurationMs
					}
				: null,
			options: options.get(entry.position) ?? [],
			selectedOptionId: entry.selectedOptionId
		}))
	};
}

export async function saveAnswer(
	db: Database,
	view: AttemptView,
	attemptQuestionId: number,
	selectedOptionId: number | null,
	now: Date
): Promise<WriteResult<void>> {
	if (view.attempt.status !== 'IN_PROGRESS') {
		return { ok: false, message: 'This attempt is no longer open.' };
	}
	if (isExpired(now, view.attempt.expiresAt)) {
		return { ok: false, message: 'Time is up for this attempt.' };
	}

	const served = view.questions.find(
		(question) => question.attemptQuestionId === attemptQuestionId
	);
	if (!served) return { ok: false, message: 'That question is not part of this attempt.' };
	if (!sectionOpen(now, view.sectionDeadlines, served.section)) {
		return { ok: false, message: 'Time is up for this section.' };
	}
	if (
		selectedOptionId !== null &&
		!served.options.some((option) => option.id === selectedOptionId)
	) {
		return { ok: false, message: 'That is not one of this question’s options.' };
	}

	const attemptStillOpen = and(
		eq(attempts.id, view.attempt.id),
		eq(attempts.status, 'IN_PROGRESS'),
		or(isNull(attempts.expiresAt), gt(attempts.expiresAt, now))
	);
	const answerCandidate = db
		.select({
			id: sql<number | null>`null`.as('id'),
			attemptId: sql<number>`${view.attempt.id}`.as('attempt_id'),
			attemptQuestionId: sql<number>`${attemptQuestionId}`.as('attempt_question_id'),
			questionId: sql<number>`${served.questionId}`.as('question_id'),
			selectedOptionId: sql<number | null>`${selectedOptionId}`.as('selected_option_id'),
			isCorrect: sql<boolean | null>`null`.as('is_correct'),
			pointsEarned: sql<number | null>`null`.as('points_earned'),
			answeredAt: sql<Date>`${Math.floor(now.getTime() / 1000)}`.as('answered_at'),
			createdAt: sql<Date>`(unixepoch())`.as('created_at'),
			updatedAt: sql<Date>`(unixepoch())`.as('updated_at')
		})
		.from(attempts)
		.where(attemptStillOpen);
	const answerWrite = db
		.insert(attemptAnswers)
		.select(answerCandidate)
		.onConflictDoUpdate({
			target: attemptAnswers.attemptQuestionId,
			set: { selectedOptionId, answeredAt: now, updatedAt: now }
		})
		.returning({ id: attemptAnswers.id });
	const bumpRevision = db
		.update(attempts)
		.set({ revision: sql`${attempts.revision} + 1` })
		.where(attemptStillOpen);
	const [written] = await db.batch([answerWrite, bumpRevision]);

	if (written.length === 0) {
		return { ok: false, message: 'This attempt is no longer open.' };
	}

	return { ok: true, value: undefined };
}

/**
 * Closes an in-progress attempt without scoring it.
 *
 * The status predicate makes repeated or racing writes harmless. The expiry predicate
 * prevents an exit request from winning after the server-owned deadline; callers settle
 * the clock before and after this write so that case becomes EXPIRED instead.
 */
export async function abandonAttempt(db: Database, attemptId: number, now: Date) {
	const [abandoned] = await db
		.update(attempts)
		.set({ status: 'ABANDONED', updatedAt: now })
		.where(
			and(
				eq(attempts.id, attemptId),
				eq(attempts.status, 'IN_PROGRESS'),
				or(isNull(attempts.expiresAt), gt(attempts.expiresAt, now))
			)
		)
		.returning({ id: attempts.id });

	return abandoned !== undefined;
}
