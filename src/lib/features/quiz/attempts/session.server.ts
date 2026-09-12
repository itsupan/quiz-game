import { and, eq } from 'drizzle-orm';

import type { WriteResult } from '$lib/domain/write-result';
import type { Database } from '$lib/server/db';
import {
	attemptAnswers,
	attemptQuestions,
	attempts,
	questions,
	quizzes,
	quizSections
} from '$lib/server/db/schema';
import { isExpired, sectionDeadlines, sectionOpen } from '../timing';
import { audioAsset, imageAsset, loadPublicOptions } from './questions.server';
import type { AttemptView } from './types.server';

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

	const sections = await db
		.select({
			section: quizSections.section,
			position: quizSections.position,
			timeLimitSeconds: quizSections.timeLimitSeconds
		})
		.from(quizSections)
		.where(eq(quizSections.quizId, row.quizId));

	const served = await db
		.select({
			attemptQuestionId: attemptQuestions.id,
			questionId: attemptQuestions.questionId,
			section: attemptQuestions.section,
			position: attemptQuestions.position,
			points: attemptQuestions.points,
			stem: questions.stem,
			imagePublicId: imageAsset.publicId,
			imageAltText: imageAsset.altText,
			audioPublicId: audioAsset.publicId,
			selectedOptionId: attemptAnswers.selectedOptionId
		})
		.from(attemptQuestions)
		.innerJoin(questions, eq(questions.id, attemptQuestions.questionId))
		.leftJoin(imageAsset, eq(imageAsset.id, questions.imageMediaId))
		.leftJoin(audioAsset, eq(audioAsset.id, questions.audioMediaId))
		.leftJoin(attemptAnswers, eq(attemptAnswers.attemptQuestionId, attemptQuestions.id))
		.where(eq(attemptQuestions.attemptId, row.attemptId))
		.orderBy(attemptQuestions.position);

	const options = await loadPublicOptions(
		db,
		served.map((entry) => entry.questionId)
	);

	return {
		attempt: {
			id: row.attemptId,
			publicId: row.attemptPublicId,
			userId: row.userId,
			status: row.status,
			startedAt: row.startedAt,
			expiresAt: row.expiresAt
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
			stem: entry.stem,
			image: entry.imagePublicId
				? { publicId: entry.imagePublicId, altText: entry.imageAltText }
				: null,
			audio: entry.audioPublicId ? { publicId: entry.audioPublicId, transcript: null } : null,
			options: options.get(entry.questionId) ?? [],
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

	await db
		.insert(attemptAnswers)
		.values({
			attemptId: view.attempt.id,
			attemptQuestionId,
			questionId: served.questionId,
			selectedOptionId,
			answeredAt: now
		})
		.onConflictDoUpdate({
			target: attemptAnswers.attemptQuestionId,
			set: { selectedOptionId, answeredAt: now }
		});

	return { ok: true, value: undefined };
}
