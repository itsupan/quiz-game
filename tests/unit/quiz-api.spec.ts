import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { ApiProblem } from '$lib/features/quiz/api/http.server';
import {
	createAttempt,
	getOwnedAttempt,
	getAttemptQuestion,
	getCompletedResult,
	listPublishedQuizzes,
	putAttemptAnswer,
	submitAttempt
} from '$lib/features/quiz/api/quiz-api.server';
import { createTestDatabase, type TestDatabase } from '$lib/server/db/test-harness';
import {
	attempts,
	questionOptions,
	questions,
	quizQuestions,
	quizSections,
	quizzes,
	users
} from '$lib/server/db/schema';

const START = new Date('2026-09-12T09:00:00.000Z');
const after = (seconds: number) => new Date(START.getTime() + seconds * 1000);

let db: TestDatabase;
let learnerId: number;
let otherLearnerId: number;
let quizPublicId: string;

beforeEach(async () => {
	db = createTestDatabase().db;

	const [learner] = await db
		.insert(users)
		.values({ email: 'api-learner@example.com', displayName: 'API learner' })
		.returning({ id: users.id });
	const [otherLearner] = await db
		.insert(users)
		.values({ email: 'api-other@example.com', displayName: 'Other learner' })
		.returning({ id: users.id });
	const [quiz] = await db
		.insert(quizzes)
		.values({
			title: 'API quiz',
			level: 'N4',
			mode: 'MOCK_TEST',
			selectionMode: 'FIXED',
			timeLimitSeconds: 60,
			status: 'PUBLISHED'
		})
		.returning({ id: quizzes.id, publicId: quizzes.publicId });
	const [section] = await db
		.insert(quizSections)
		.values({
			quizId: quiz.id,
			section: 'VOCAB_KANJI',
			position: 1,
			timeLimitSeconds: 60
		})
		.returning({ id: quizSections.id });
	const [question] = await db
		.insert(questions)
		.values({
			stem: '「病院」の読み方はどれですか。',
			explanation: '「びょういん」と読みます。',
			level: 'N4',
			section: 'VOCAB_KANJI',
			status: 'PUBLISHED'
		})
		.returning({ id: questions.id });

	await db.insert(questionOptions).values([
		{ questionId: question.id, body: 'びょういん', isCorrect: true, position: 1 },
		{ questionId: question.id, body: 'びよういん', isCorrect: false, position: 2 }
	]);
	await db.insert(quizQuestions).values({
		quizId: quiz.id,
		quizSectionId: section.id,
		questionId: question.id,
		position: 1
	});

	learnerId = learner.id;
	otherLearnerId = otherLearner.id;
	quizPublicId = quiz.publicId;
});

describe('quiz API application facade', () => {
	it('lists only matching published quizzes with public data', async () => {
		await db.insert(quizzes).values({
			title: 'Draft quiz',
			level: 'N4',
			mode: 'MOCK_TEST',
			selectionMode: 'FIXED',
			status: 'DRAFT'
		});

		const page = await listPublishedQuizzes(db, {
			level: 'N4',
			section: 'VOCAB_KANJI',
			limit: 20
		});

		expect(page.items).toHaveLength(1);
		expect(page.items[0]).toMatchObject({ id: quizPublicId, sections: ['VOCAB_KANJI'] });
		expect(page.nextCursor).toBeNull();
	});

	it('runs the complete attempt workflow without leaking an answer key before submission', async () => {
		const started = await createAttempt(db, quizPublicId, learnerId, 'complete-flow-key', START);
		const attempt = await getOwnedAttempt(db, started.attemptId, learnerId, START);
		const question = await getAttemptQuestion(db, started.attemptId, 1, learnerId, START);

		expect(started.created).toBe(true);
		expect(attempt).toMatchObject({ status: 'IN_PROGRESS', progress: { answered: 0, total: 1 } });
		expect(JSON.stringify(question)).not.toMatch(/correct|explanation|transcript/i);
		expect(question.options).toEqual([
			{ number: 1, body: 'びょういん' },
			{ number: 2, body: 'びよういん' }
		]);

		const answered = await putAttemptAnswer(db, started.attemptId, 1, 1, learnerId, after(5));
		expect(answered.selectedOptionNumber).toBe(1);

		const result = await submitAttempt(db, started.attemptId, learnerId, after(10));
		expect(result.attempt).toMatchObject({ status: 'SUBMITTED', correctCount: 1, rawScore: 1 });
		expect(result.questions[0]).toMatchObject({
			selectedOptionNumber: 1,
			correctOptionNumber: 1,
			isCorrect: true
		});

		const repeated = await submitAttempt(db, started.attemptId, learnerId, after(20));
		expect(repeated).toEqual(result);
	});

	it('returns the same attempt for a retried start request', async () => {
		const first = await createAttempt(db, quizPublicId, learnerId, 'retry-start-key', START);
		const second = await createAttempt(db, quizPublicId, learnerId, 'retry-start-key', after(1));
		const rows = await db
			.select({ id: attempts.id })
			.from(attempts)
			.where(eq(attempts.userId, learnerId));

		expect(first.created).toBe(true);
		expect(second).toEqual({ attemptId: first.attemptId, created: false });
		expect(rows).toHaveLength(1);
	});

	it('hides another learner’s attempt from every attempt operation', async () => {
		const started = await createAttempt(db, quizPublicId, learnerId, 'private-attempt-key', START);
		const operations = [
			() => getOwnedAttempt(db, started.attemptId, otherLearnerId, START),
			() => getAttemptQuestion(db, started.attemptId, 1, otherLearnerId, START),
			() => putAttemptAnswer(db, started.attemptId, 1, 1, otherLearnerId, START),
			() => submitAttempt(db, started.attemptId, otherLearnerId, START),
			() => getCompletedResult(db, started.attemptId, otherLearnerId, START)
		];

		for (const operation of operations) {
			await expect(operation()).rejects.toMatchObject({
				status: 404,
				code: 'attempt_not_found'
			} satisfies Partial<ApiProblem>);
		}
	});

	it('settles an expired attempt before returning it or accepting another answer', async () => {
		const started = await createAttempt(db, quizPublicId, learnerId, 'expired-attempt-key', START);
		const attempt = await getOwnedAttempt(db, started.attemptId, learnerId, after(60));

		expect(attempt.status).toBe('EXPIRED');
		await expect(
			putAttemptAnswer(db, started.attemptId, 1, 1, learnerId, after(60))
		).rejects.toMatchObject({ status: 409, code: 'attempt_closed' } satisfies Partial<ApiProblem>);

		const result = await getCompletedResult(db, started.attemptId, learnerId, after(60));
		expect(result.attempt).toMatchObject({ status: 'EXPIRED', correctCount: 0 });
	});

	it('rejects option numbers that are not part of the served question', async () => {
		const started = await createAttempt(db, quizPublicId, learnerId, 'invalid-option-key', START);

		await expect(
			putAttemptAnswer(db, started.attemptId, 1, 99, learnerId, after(1))
		).rejects.toMatchObject({
			status: 422,
			code: 'option_not_found'
		} satisfies Partial<ApiProblem>);
	});
});
