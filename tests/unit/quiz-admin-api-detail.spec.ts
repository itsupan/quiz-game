import { beforeEach, describe, expect, it } from 'vitest';

import {
	attachQuestion,
	findAttachedQuestion,
	getSectionByEnum,
	quizPublishBlockersFor,
	upsertSection
} from '$lib/features/quiz/admin/quizzes.server';
import { toAttachableDto, toAttachedQuestionDtos } from '$lib/features/quiz/admin/api-dto';
import { requireQuizDetail, quizDetailDto } from '$lib/features/quiz/admin/api-detail.server';
import { createTestDatabase, type TestDatabase } from '$lib/server/db/test-harness';
import { ApiProblem } from '$lib/server/http/problem';
import { questionOptions, questions, quizzes, users } from '$lib/server/db/schema';

let db: TestDatabase;
let adminId: number;

beforeEach(async () => {
	db = createTestDatabase().db;

	const [admin] = await db
		.insert(users)
		.values({ email: 'admin@example.com', displayName: 'Admin', role: 'ADMIN' })
		.returning({ id: users.id });
	adminId = admin.id;
});

async function seedFixedQuiz() {
	const [quiz] = await db
		.insert(quizzes)
		.values({
			title: 'Fixed quiz',
			mode: 'JLPT_PRACTICE',
			level: 'N4',
			selectionMode: 'FIXED',
			createdBy: adminId
		})
		.returning();

	await upsertSection(db, quiz.id, null, {
		section: 'VOCAB_KANJI',
		position: 1,
		timeLimitSeconds: null,
		drawCount: null
	});

	return quiz;
}

async function seedPublishedQuestion() {
	const [question] = await db
		.insert(questions)
		.values({
			stem: 'stem',
			level: 'N4',
			section: 'VOCAB_KANJI',
			status: 'PUBLISHED',
			createdBy: adminId
		})
		.returning();
	await db.insert(questionOptions).values([
		{ questionId: question.id, body: 'a', isCorrect: true, position: 1 },
		{ questionId: question.id, body: 'b', isCorrect: false, position: 2 }
	]);

	return question;
}

describe('getSectionByEnum', () => {
	it('finds a section by its enum value, scoped to the quiz', async () => {
		const quiz = await seedFixedQuiz();
		const found = await getSectionByEnum(db, quiz.id, 'VOCAB_KANJI');
		expect(found?.section).toBe('VOCAB_KANJI');
	});

	it('returns null for a section the quiz does not have', async () => {
		const quiz = await seedFixedQuiz();
		expect(await getSectionByEnum(db, quiz.id, 'LISTENING')).toBeNull();
	});
});

describe('findAttachedQuestion', () => {
	it('finds the quiz_questions row joining a quiz to a bank question', async () => {
		const quiz = await seedFixedQuiz();
		const question = await seedPublishedQuestion();
		const section = await getSectionByEnum(db, quiz.id, 'VOCAB_KANJI');
		await attachQuestion(db, quiz, section!.id, question.id);

		const found = await findAttachedQuestion(db, quiz.id, question.id);
		expect(found).not.toBeNull();
	});

	it('returns null when the question is not attached', async () => {
		const quiz = await seedFixedQuiz();
		const question = await seedPublishedQuestion();
		expect(await findAttachedQuestion(db, quiz.id, question.id)).toBeNull();
	});
});

describe('requireQuizDetail / quizDetailDto', () => {
	it('404s for an unknown quiz', async () => {
		await expect(requireQuizDetail(db, '01JSEEDDOESNOTEXIST00000000')).rejects.toThrow(ApiProblem);
	});

	it('exposes only public ids, never internal numeric ids or section row ids', async () => {
		const quiz = await seedFixedQuiz();
		const question = await seedPublishedQuestion();
		const section = await getSectionByEnum(db, quiz.id, 'VOCAB_KANJI');
		await attachQuestion(db, quiz, section!.id, question.id);

		const found = await requireQuizDetail(db, quiz.publicId);
		const dto = await quizDetailDto(db, found);

		expect(dto.id).toBe(quiz.publicId);
		expect(dto).not.toHaveProperty('createdBy');
		expect(dto.sections).toEqual([
			{
				section: 'VOCAB_KANJI',
				position: 1,
				timeLimitSeconds: null,
				drawCount: null,
				questionCount: 1,
				bankCount: 1
			}
		]);
		expect(dto.attached).toEqual([
			{
				questionId: question.publicId,
				section: 'VOCAB_KANJI',
				stem: 'stem',
				position: 1,
				points: 1,
				status: 'PUBLISHED'
			}
		]);
		// A fixed quiz with its only bank question already attached has nothing left to offer.
		expect(dto.attachable).toEqual({ VOCAB_KANJI: [] });
		expect(dto.blockers).toEqual([]);
	});
});

describe('quizPublishBlockersFor', () => {
	it('blocks an empty fixed quiz and unblocks once a question is attached', async () => {
		const quiz = await seedFixedQuiz();
		const section = await getSectionByEnum(db, quiz.id, 'VOCAB_KANJI');

		expect(await quizPublishBlockersFor(db, quiz, [section!])).toHaveLength(1);

		const question = await seedPublishedQuestion();
		await attachQuestion(db, quiz, section!.id, question.id);

		expect(await quizPublishBlockersFor(db, quiz, [section!])).toEqual([]);
	});
});

describe('DTO mappers reused by the quiz-questions endpoint', () => {
	it('map attached/attachable by section enum, not by internal section id', async () => {
		const quiz = await seedFixedQuiz();
		const section = await getSectionByEnum(db, quiz.id, 'VOCAB_KANJI');
		const question = await seedPublishedQuestion();
		await attachQuestion(db, quiz, section!.id, question.id);

		const { listAttachedQuestions, listAttachableQuestions } =
			await import('$lib/features/quiz/admin/quizzes.server');
		const attached = await listAttachedQuestions(db, quiz.id);
		const attachable = await listAttachableQuestions(db, quiz, [section!]);

		expect(toAttachedQuestionDtos(attached, [section!])[0].section).toBe('VOCAB_KANJI');
		expect(toAttachableDto(attachable, [section!])).toEqual({ VOCAB_KANJI: [] });
	});
});
