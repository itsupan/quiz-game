import { and, desc, eq, inArray, lt } from 'drizzle-orm';

import type { JlptLevel, QuizMode, Section } from '$lib/domain/enums';
import type { Database } from '$lib/server/db';
import { quizzes, quizSections } from '$lib/server/db/schema';
import { loadQuizOverview } from '../attempts.server';
import { apiProblem } from './http.server';

export type CatalogFilters = {
	level?: JlptLevel;
	mode?: QuizMode;
	section?: Section;
	cursor?: string;
	limit: number;
};

async function sectionsForQuizzes(db: Database, quizIds: number[]) {
	if (quizIds.length === 0) return new Map<number, Section[]>();

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

export async function listPublishedQuizzes(db: Database, filters: CatalogFilters) {
	let sectionQuizIds: number[] | null = null;
	if (filters.section) {
		sectionQuizIds = (
			await db
				.select({ quizId: quizSections.quizId })
				.from(quizSections)
				.where(eq(quizSections.section, filters.section))
		).map((row) => row.quizId);

		if (sectionQuizIds.length === 0) return { items: [], nextCursor: null };
	}

	const rows = await db
		.select({
			id: quizzes.id,
			publicId: quizzes.publicId,
			title: quizzes.title,
			description: quizzes.description,
			level: quizzes.level,
			mode: quizzes.mode,
			selectionMode: quizzes.selectionMode,
			timeLimitSeconds: quizzes.timeLimitSeconds
		})
		.from(quizzes)
		.where(
			and(
				eq(quizzes.status, 'PUBLISHED'),
				filters.level ? eq(quizzes.level, filters.level) : undefined,
				filters.mode ? eq(quizzes.mode, filters.mode) : undefined,
				filters.cursor ? lt(quizzes.publicId, filters.cursor) : undefined,
				sectionQuizIds ? inArray(quizzes.id, sectionQuizIds) : undefined
			)
		)
		.orderBy(desc(quizzes.publicId))
		.limit(filters.limit + 1);
	const hasMore = rows.length > filters.limit;
	const page = hasMore ? rows.slice(0, filters.limit) : rows;
	const sections = await sectionsForQuizzes(
		db,
		page.map((quiz) => quiz.id)
	);

	return {
		items: page.map(({ id: databaseId, publicId, ...quiz }) => ({
			id: publicId,
			...quiz,
			sections: sections.get(databaseId) ?? []
		})),
		nextCursor: hasMore ? (page.at(-1)?.publicId ?? null) : null
	};
}

export async function getPublishedQuiz(db: Database, quizId: string) {
	const quiz = await loadQuizOverview(db, quizId);
	if (!quiz) {
		apiProblem(404, 'quiz_not_found', 'Quiz not found', 'The published quiz does not exist.');
	}

	return {
		id: quiz.publicId,
		title: quiz.title,
		description: quiz.description,
		mode: quiz.mode,
		level: quiz.level,
		selectionMode: quiz.selectionMode,
		timeLimitSeconds: quiz.timeLimitSeconds,
		sections: quiz.sections
	};
}
