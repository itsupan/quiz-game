import { desc, eq } from 'drizzle-orm';
import { quizzes } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

/**
 * Scaffold listing, kept narrow on purpose: it selects the columns the page renders
 * rather than `select()`, so nothing extra is serialised into the page payload. The
 * real homepage — hero, level and section filters, quiz cards — is its own epic.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const rows = await locals.db
		.select({
			id: quizzes.id,
			publicId: quizzes.publicId,
			title: quizzes.title,
			level: quizzes.level,
			mode: quizzes.mode,
			createdAt: quizzes.createdAt
		})
		.from(quizzes)
		.where(eq(quizzes.status, 'PUBLISHED'))
		.orderBy(desc(quizzes.createdAt));

	return { quizzes: rows };
};
