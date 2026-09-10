import { desc, eq, inArray } from 'drizzle-orm';
import { quizzes, quizSections } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const dbQuizzes = await locals.db
		.select({
			id: quizzes.id,
			publicId: quizzes.publicId,
			title: quizzes.title,
			description: quizzes.description,
			level: quizzes.level,
			mode: quizzes.mode,
			createdAt: quizzes.createdAt
		})
		.from(quizzes)
		.where(eq(quizzes.status, 'PUBLISHED'))
		.orderBy(desc(quizzes.createdAt));

	const sectionMap: Record<number, string[]> = {};
	if (dbQuizzes.length > 0) {
		const quizIds = dbQuizzes.map((q) => q.id);
		const sections = await locals.db
			.select({
				quizId: quizSections.quizId,
				section: quizSections.section
			})
			.from(quizSections)
			.where(inArray(quizSections.quizId, quizIds));

		for (const row of sections) {
			if (!sectionMap[row.quizId]) {
				sectionMap[row.quizId] = [];
			}
			sectionMap[row.quizId].push(row.section);
		}
	}

	const items = dbQuizzes.map((q) => ({
		publicId: q.publicId,
		title: q.title,
		description: q.description,
		level: q.level,
		mode: q.mode,
		sections: sectionMap[q.id] ?? [],
		createdAt: q.createdAt.toISOString()
	}));

	return {
		quizzes: items,
		streakDays: 14,
		user: locals.user
			? {
					displayName: locals.user.displayName,
					email: locals.user.email,
					role: locals.user.role
				}
			: null
	};
};
