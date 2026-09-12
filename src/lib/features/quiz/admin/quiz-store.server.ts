import { and, count, desc, eq } from 'drizzle-orm';

import type { Database } from '$lib/server/db';
import { quizQuestions, quizzes, quizSections } from '$lib/server/db/schema';
import type { ContentStatus, JlptLevel, Quiz, QuizMode } from '$lib/server/db/schema';
import type { QuizInput } from './validation';

export type QuizListItem = Pick<
	Quiz,
	| 'publicId'
	| 'title'
	| 'mode'
	| 'level'
	| 'selectionMode'
	| 'icon'
	| 'status'
	| 'timeLimitSeconds'
	| 'createdAt'
	| 'updatedAt'
> & { sectionCount: number; questionCount: number };

export type QuizFilters = {
	status?: ContentStatus;
	level?: JlptLevel;
	mode?: QuizMode;
	page?: number;
	/** Defaults to `PAGE_SIZE`. The admin dashboard never overrides this; the JSON API does. */
	limit?: number;
};

export const PAGE_SIZE = 25;

export async function listQuizzes(db: Database, filters: QuizFilters = {}) {
	const page = Math.max(1, filters.page ?? 1);
	const limit = filters.limit ?? PAGE_SIZE;
	const where = and(
		filters.status ? eq(quizzes.status, filters.status) : undefined,
		filters.level ? eq(quizzes.level, filters.level) : undefined,
		filters.mode ? eq(quizzes.mode, filters.mode) : undefined
	);
	const items = await db
		.select({
			publicId: quizzes.publicId,
			title: quizzes.title,
			mode: quizzes.mode,
			level: quizzes.level,
			selectionMode: quizzes.selectionMode,
			icon: quizzes.icon,
			status: quizzes.status,
			timeLimitSeconds: quizzes.timeLimitSeconds,
			createdAt: quizzes.createdAt,
			updatedAt: quizzes.updatedAt,
			sectionCount: db.$count(quizSections, eq(quizSections.quizId, quizzes.id)),
			questionCount: db.$count(quizQuestions, eq(quizQuestions.quizId, quizzes.id))
		})
		.from(quizzes)
		.where(where)
		.orderBy(desc(quizzes.updatedAt))
		.limit(limit)
		.offset((page - 1) * limit);
	const [{ total }] = await db.select({ total: count() }).from(quizzes).where(where);

	return { items, total, page, pageCount: Math.max(1, Math.ceil(total / limit)) };
}

export async function getQuiz(db: Database, publicId: string) {
	const [quiz] = await db.select().from(quizzes).where(eq(quizzes.publicId, publicId));
	if (!quiz) return null;

	const sections = await db
		.select()
		.from(quizSections)
		.where(eq(quizSections.quizId, quiz.id))
		.orderBy(quizSections.position);

	return { quiz, sections };
}

export async function createQuiz(
	db: Database,
	actorUserId: number | null,
	input: QuizInput
): Promise<string> {
	const [created] = await db
		.insert(quizzes)
		.values({ ...input, createdBy: actorUserId })
		.returning({ publicId: quizzes.publicId });

	return created.publicId;
}

export async function updateQuiz(db: Database, quizId: number, input: QuizInput): Promise<void> {
	await db.update(quizzes).set(input).where(eq(quizzes.id, quizId));
	if (input.selectionMode === 'FIXED') {
		await db.update(quizSections).set({ drawCount: null }).where(eq(quizSections.quizId, quizId));
	}
}

export async function setQuizStatus(
	db: Database,
	quiz: { id: number; publishedAt: Date | null },
	status: ContentStatus
): Promise<void> {
	await db
		.update(quizzes)
		.set({
			status,
			publishedAt: status === 'PUBLISHED' && !quiz.publishedAt ? new Date() : quiz.publishedAt
		})
		.where(eq(quizzes.id, quiz.id));
}
