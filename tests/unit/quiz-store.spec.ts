import { beforeEach, describe, expect, it } from 'vitest';

import { listQuizzes } from '$lib/features/quiz/admin/quiz-store.server';
import { upsertSection } from '$lib/features/quiz/admin/sections.server';
import { createTestDatabase, type TestDatabase } from '$lib/server/db/test-harness';
import { quizQuestions, quizSections, quizzes, questions, users } from '$lib/server/db/schema';
import type { QuizSectionInput } from '$lib/features/quiz/admin/validation';
import { eq } from 'drizzle-orm';

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

async function insertQuiz(overrides: Partial<typeof quizzes.$inferInsert> = {}) {
	const [quiz] = await db
		.insert(quizzes)
		.values({
			title: 'A quiz',
			description: 'A description',
			mode: 'JLPT_PRACTICE',
			level: 'N4',
			selectionMode: 'FIXED',
			createdBy: adminId,
			...overrides
		})
		.returning();

	return quiz;
}

async function insertSection(
	quizId: number,
	overrides: Partial<QuizSectionInput> & Pick<QuizSectionInput, 'section'>
) {
	const result = await upsertSection(db, quizId, null, {
		position: 1,
		timeLimitSeconds: null,
		drawCount: null,
		...overrides
	});
	if (!result.ok) throw new Error(result.message);
}

describe('listQuizzes', () => {
	it('includes the description', async () => {
		await insertQuiz({ description: 'Covers the JLPT N4 vocabulary list.' });

		const { items } = await listQuizzes(db);

		expect(items[0].description).toBe('Covers the JLPT N4 vocabulary list.');
	});

	it('tags each quiz with the sections it covers, in position order', async () => {
		const quiz = await insertQuiz();
		await insertSection(quiz.id, { section: 'LISTENING', position: 2 });
		await insertSection(quiz.id, { section: 'VOCAB_KANJI', position: 1 });

		const { items } = await listQuizzes(db);

		expect(items[0].sections).toEqual(['VOCAB_KANJI', 'LISTENING']);
	});

	it('reports zero sections for a quiz with none yet', async () => {
		await insertQuiz();

		const { items } = await listQuizzes(db);

		expect(items[0].sections).toEqual([]);
	});

	describe('question count', () => {
		it('counts attached questions for a FIXED quiz', async () => {
			const quiz = await insertQuiz({ selectionMode: 'FIXED' });
			await insertSection(quiz.id, { section: 'VOCAB_KANJI' });
			const [question] = await db
				.insert(questions)
				.values({ stem: 'stem', level: 'N4', section: 'VOCAB_KANJI', status: 'PUBLISHED' })
				.returning();
			const [section] = await db
				.select()
				.from(quizSections)
				.where(eq(quizSections.quizId, quiz.id));
			await db.insert(quizQuestions).values({
				quizId: quiz.id,
				quizSectionId: section.id,
				questionId: question.id,
				position: 1
			});

			const { items } = await listQuizzes(db);

			expect(items[0].questionCount).toBe(1);
		});

		it('reports the planned draw total for a RANDOM quiz instead of the empty attached count', async () => {
			// quiz_questions is empty by design for a RANDOM quiz — the count that matters is
			// what each section will actually draw from the bank at attempt start.
			const quiz = await insertQuiz({ selectionMode: 'RANDOM' });
			await insertSection(quiz.id, { section: 'VOCAB_KANJI', position: 1, drawCount: 5 });
			await insertSection(quiz.id, { section: 'LISTENING', position: 2, drawCount: 3 });

			const { items } = await listQuizzes(db);

			expect(items[0].questionCount).toBe(8);
		});

		it('reports zero for a RANDOM quiz whose sections have no draw count yet', async () => {
			const quiz = await insertQuiz({ selectionMode: 'RANDOM' });
			await insertSection(quiz.id, { section: 'VOCAB_KANJI', drawCount: null });

			const { items } = await listQuizzes(db);

			expect(items[0].questionCount).toBe(0);
		});
	});

	describe('section filter', () => {
		it('matches only quizzes that have a section for the requested value', async () => {
			const withListening = await insertQuiz({ title: 'Has listening' });
			await insertSection(withListening.id, { section: 'LISTENING' });
			const withoutListening = await insertQuiz({ title: 'No listening' });
			await insertSection(withoutListening.id, { section: 'VOCAB_KANJI' });

			const { items } = await listQuizzes(db, { section: 'LISTENING' });

			expect(items.map((item) => item.title)).toEqual(['Has listening']);
		});
	});

	describe('date sort', () => {
		it('defaults to newest first', async () => {
			const older = await insertQuiz({ title: 'Older' });
			await db
				.update(quizzes)
				.set({ updatedAt: new Date(2020, 0, 1) })
				.where(eq(quizzes.id, older.id));
			const newer = await insertQuiz({ title: 'Newer' });
			await db
				.update(quizzes)
				.set({ updatedAt: new Date(2024, 0, 1) })
				.where(eq(quizzes.id, newer.id));

			const { items } = await listQuizzes(db);

			expect(items.map((item) => item.title)).toEqual(['Newer', 'Older']);
		});

		it('sorts oldest first when asked', async () => {
			const older = await insertQuiz({ title: 'Older' });
			await db
				.update(quizzes)
				.set({ updatedAt: new Date(2020, 0, 1) })
				.where(eq(quizzes.id, older.id));
			const newer = await insertQuiz({ title: 'Newer' });
			await db
				.update(quizzes)
				.set({ updatedAt: new Date(2024, 0, 1) })
				.where(eq(quizzes.id, newer.id));

			const { items } = await listQuizzes(db, { sort: 'oldest' });

			expect(items.map((item) => item.title)).toEqual(['Older', 'Newer']);
		});
	});

	it('still applies the existing status, level and mode filters', async () => {
		await insertQuiz({ title: 'Draft N4', status: 'DRAFT', level: 'N4' });
		await insertQuiz({ title: 'Published N3', status: 'PUBLISHED', level: 'N3' });

		const { items } = await listQuizzes(db, { status: 'PUBLISHED' });

		expect(items.map((item) => item.title)).toEqual(['Published N3']);
	});
});
