import { and, eq } from 'drizzle-orm';

import type { Database } from '$lib/server/db';
import { attempts, quizzes } from '$lib/server/db/schema';
import {
	abandonAttempt,
	enforceDeadline,
	finalizeAttempt,
	loadAttempt,
	loadResult,
	saveAnswer,
	startPublishedAttempt
} from '../attempts.server';
import type { AttemptView } from '../attempts/types.server';
import { sectionOpen } from '../timing';
import { apiProblem } from './http.server';
import { toAttemptDto, toQuestionDto, toResultDto } from './dto';

async function findIdempotentAttempt(db: Database, userId: number, key: string) {
	const [existing] = await db
		.select({
			attemptId: attempts.publicId,
			quizId: quizzes.publicId,
			status: attempts.status
		})
		.from(attempts)
		.innerJoin(quizzes, eq(quizzes.id, attempts.quizId))
		.where(and(eq(attempts.userId, userId), eq(attempts.idempotencyKey, key)));

	return existing ?? null;
}

export async function createAttempt(
	db: Database,
	quizId: string,
	userId: number,
	idempotencyKey: string,
	now: Date
) {
	const existing = await findIdempotentAttempt(db, userId, idempotencyKey);
	if (existing) {
		if (existing.quizId !== quizId) {
			apiProblem(
				409,
				'idempotency_key_reused',
				'Idempotency-Key conflict',
				'This Idempotency-Key was already used to start another quiz.'
			);
		}

		return { attemptId: existing.attemptId, status: existing.status, created: false };
	}

	try {
		const written = await startPublishedAttempt(db, quizId, userId, now, idempotencyKey);
		if (!written) {
			apiProblem(404, 'quiz_not_found', 'Quiz not found', 'The published quiz does not exist.');
		}
		if (!written.ok) {
			apiProblem(409, 'quiz_unavailable', 'Quiz unavailable', written.message);
		}

		return { attemptId: written.value, status: 'IN_PROGRESS' as const, created: true };
	} catch (cause) {
		const replay = await findIdempotentAttempt(db, userId, idempotencyKey);
		if (replay?.quizId === quizId) {
			return { attemptId: replay.attemptId, status: replay.status, created: false };
		}
		throw cause;
	}
}

async function loadOwnedSettledAttempt(
	db: Database,
	attemptId: string,
	userId: number,
	now: Date
): Promise<AttemptView> {
	let view = await loadAttempt(db, attemptId, userId);
	if (!view) {
		apiProblem(404, 'attempt_not_found', 'Attempt not found', 'The attempt does not exist.');
	}

	const status = await enforceDeadline(db, view, now);
	if (status !== view.attempt.status) {
		view = await loadAttempt(db, attemptId, userId);
		if (!view) {
			apiProblem(404, 'attempt_not_found', 'Attempt not found', 'The attempt does not exist.');
		}
	}

	return view;
}

export async function getOwnedAttempt(db: Database, attemptId: string, userId: number, now: Date) {
	return toAttemptDto(await loadOwnedSettledAttempt(db, attemptId, userId, now), now);
}

export async function abandonOwnedAttempt(
	db: Database,
	attemptId: string,
	userId: number,
	now: Date
) {
	let view = await loadOwnedSettledAttempt(db, attemptId, userId, now);

	if (view.attempt.status === 'ABANDONED') {
		return {
			id: view.attempt.publicId,
			status: view.attempt.status,
			links: {
				quiz: `/api/v1/quizzes/${view.quiz.publicId}`,
				catalog: '/api/v1/quizzes'
			}
		};
	}

	if (view.attempt.status !== 'IN_PROGRESS') {
		apiProblem(409, 'attempt_closed', 'Attempt closed', `The attempt is ${view.attempt.status}.`);
	}

	await abandonAttempt(db, view.attempt.id, now);
	view = await loadOwnedSettledAttempt(db, attemptId, userId, now);

	if (view.attempt.status !== 'ABANDONED') {
		apiProblem(409, 'attempt_closed', 'Attempt closed', `The attempt is ${view.attempt.status}.`);
	}

	return {
		id: view.attempt.publicId,
		status: view.attempt.status,
		links: {
			quiz: `/api/v1/quizzes/${view.quiz.publicId}`,
			catalog: '/api/v1/quizzes'
		}
	};
}

export async function getAttemptQuestion(
	db: Database,
	attemptId: string,
	questionNumber: number,
	userId: number,
	now: Date
) {
	return toQuestionDto(
		await loadOwnedSettledAttempt(db, attemptId, userId, now),
		questionNumber,
		now
	);
}

export async function putAttemptAnswer(
	db: Database,
	attemptId: string,
	questionNumber: number,
	selectedOptionNumber: number | null,
	userId: number,
	now: Date
) {
	const view = await loadOwnedSettledAttempt(db, attemptId, userId, now);
	if (view.attempt.status !== 'IN_PROGRESS') {
		apiProblem(409, 'attempt_closed', 'Attempt closed', `The attempt is ${view.attempt.status}.`);
	}

	const question = view.questions.find((entry) => entry.position === questionNumber);
	if (!question) {
		apiProblem(
			404,
			'question_not_found',
			'Question not found',
			'That question was not served in this attempt.'
		);
	}
	if (!sectionOpen(now, view.sectionDeadlines, question.section)) {
		apiProblem(409, 'section_closed', 'Section closed', 'The section deadline has passed.');
	}
	const selectedOption =
		selectedOptionNumber === null
			? null
			: question.options.find((option) => option.position === selectedOptionNumber);
	if (selectedOptionNumber !== null && !selectedOption) {
		apiProblem(
			422,
			'option_not_found',
			'Invalid option',
			'That option does not belong to this question.'
		);
	}

	const written = await saveAnswer(
		db,
		view,
		question.attemptQuestionId,
		selectedOption?.id ?? null,
		now
	);
	if (!written.ok) {
		apiProblem(409, 'attempt_closed', 'Answer rejected', written.message);
	}

	const refreshed = await loadOwnedSettledAttempt(db, attemptId, userId, now);
	return toQuestionDto(refreshed, questionNumber, now);
}

async function completedResult(db: Database, attemptId: string, userId: number) {
	const result = await loadResult(db, attemptId, userId);
	if (!result) {
		apiProblem(
			409,
			'result_not_ready',
			'Result not ready',
			'Submit the attempt before requesting its result.'
		);
	}
	if (result.attempt.status === 'ABANDONED') {
		apiProblem(
			409,
			'attempt_abandoned',
			'Attempt abandoned',
			'An abandoned attempt has no result.'
		);
	}

	return toResultDto(result);
}

export async function submitAttempt(db: Database, attemptId: string, userId: number, now: Date) {
	const view = await loadOwnedSettledAttempt(db, attemptId, userId, now);
	if (view.attempt.status === 'ABANDONED') {
		apiProblem(
			409,
			'attempt_abandoned',
			'Attempt abandoned',
			'An abandoned attempt cannot be submitted.'
		);
	}
	if (view.attempt.status === 'IN_PROGRESS') {
		await finalizeAttempt(db, view.attempt.id, 'SUBMITTED', now);
	}

	return completedResult(db, attemptId, userId);
}

export async function getCompletedResult(
	db: Database,
	attemptId: string,
	userId: number,
	now: Date
) {
	const view = await loadOwnedSettledAttempt(db, attemptId, userId, now);
	if (view.attempt.status === 'IN_PROGRESS') {
		apiProblem(
			409,
			'result_not_ready',
			'Result not ready',
			'Submit the attempt before requesting its result.'
		);
	}

	return completedResult(db, attemptId, userId);
}
