import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';

import type { Section } from '$lib/domain/enums';
import type { Database } from '$lib/server/db';
import { quizQuestions, quizzes, quizSections } from '$lib/server/db/schema';
import type { ContentStatus, JlptLevel, Quiz, QuizMode } from '$lib/server/db/schema';
import type { QuizInput } from './validation';

export type QuizListItem = Pick<
	Quiz,
	| 'publicId'
	| 'title'
	| 'description'
	| 'mode'
	| 'level'
	| 'selectionMode'
	| 'icon'
	| 'status'
	| 'timeLimitSeconds'
	| 'createdAt'
	| 'updatedAt'
> & { sectionCount: number; questionCount: number; sections: Section[] };

export type QuizSort = 'newest' | 'oldest';

export type QuizFilters = {
	status?: ContentStatus;
	level?: JlptLevel;
	mode?: QuizMode;
	/** Matches a quiz that has a section for this content section. */
	section?: Section;
	/** By `updatedAt`. Defaults to `newest`. */
	sort?: QuizSort;
	page?: number;
	/** Defaults to `PAGE_SIZE`. The admin dashboard never overrides this; the JSON API does. */
	limit?: number;
};

export const PAGE_SIZE = 25;

/** The section tags shown on a quiz's card, in `quiz_sections.position` order. */
async function sectionTagsByQuiz(db: Database, quizIds: number[]): Promise<Map<number, Section[]>> {
	if (quizIds.length === 0) return new Map();

	const rows = await db
		.select({ quizId: quizSections.quizId, section: quizSections.section })
		.from(quizSections)
		.where(inArray(quizSections.quizId, quizIds))
		.orderBy(quizSections.position);

	const grouped = new Map<number, Section[]>();
	for (const row of rows) {
		const sections = grouped.get(row.quizId) ?? [];
		sections.push(row.section);
		grouped.set(row.quizId, sections);
	}

	return grouped;
}

export async function listQuizzes(db: Database, filters: QuizFilters = {}) {
	const page = Math.max(1, filters.page ?? 1);
	const limit = filters.limit ?? PAGE_SIZE;
	const where = and(
		filters.status ? eq(quizzes.status, filters.status) : undefined,
		filters.level ? eq(quizzes.level, filters.level) : undefined,
		filters.mode ? eq(quizzes.mode, filters.mode) : undefined,
		filters.section
			? inArray(
					quizzes.id,
					db
						.select({ quizId: quizSections.quizId })
						.from(quizSections)
						.where(eq(quizSections.section, filters.section))
				)
			: undefined
	);
	const orderBy = filters.sort === 'oldest' ? asc(quizzes.updatedAt) : desc(quizzes.updatedAt);

	const rows = await db
		.select({
			id: quizzes.id,
			publicId: quizzes.publicId,
			title: quizzes.title,
			description: quizzes.description,
			mode: quizzes.mode,
			level: quizzes.level,
			selectionMode: quizzes.selectionMode,
			icon: quizzes.icon,
			status: quizzes.status,
			timeLimitSeconds: quizzes.timeLimitSeconds,
			createdAt: quizzes.createdAt,
			updatedAt: quizzes.updatedAt,
			sectionCount: db.$count(quizSections, eq(quizSections.quizId, quizzes.id)),
			attachedQuestionCount: db.$count(quizQuestions, eq(quizQuestions.quizId, quizzes.id)),
			// RANDOM quizzes never populate quiz_questions — what they will actually serve is
			// the sum of each section's draw_count, not zero. Written with literal
			// table-qualified names: a second `${quizSections.column}` reference inside a raw
			// `sql` template silently drops its table qualifier once that table has already
			// appeared elsewhere in the same compiled query (as it has, in sectionCount above).
			plannedDrawTotal: sql<number>`(
				select coalesce(sum(quiz_sections.draw_count), 0)
				from quiz_sections
				where quiz_sections.quiz_id = quizzes.id
			)`.mapWith(Number)
		})
		.from(quizzes)
		.where(where)
		.orderBy(orderBy)
		.limit(limit)
		.offset((page - 1) * limit);
	const [{ total }] = await db.select({ total: count() }).from(quizzes).where(where);

	const sectionsByQuiz = await sectionTagsByQuiz(
		db,
		rows.map((row) => row.id)
	);

	const items: QuizListItem[] = rows.map(
		({ id, attachedQuestionCount, plannedDrawTotal, ...row }) => ({
			...row,
			sections: sectionsByQuiz.get(id) ?? [],
			questionCount: row.selectionMode === 'RANDOM' ? plannedDrawTotal : attachedQuestionCount
		})
	);

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
