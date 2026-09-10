import { redirect } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { quizzes } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

/**
 * Scaffold listing, kept narrow on purpose: it selects the columns the page renders
 * rather than `select()`, so nothing extra is serialised into the page payload.
 *
 * The internal integer `id` is deliberately NOT among them. Shipping it would hand the
 * browser the sequential keys that `public_id` exists to hide, letting anyone read the
 * catalogue size and publication order straight out of the page data.
 *
 * The real homepage — hero, level and section filters, quiz cards — is its own epic.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user && locals.user.role !== 'ADMIN') {
		redirect(302, '/home');
	}

	const rows = await locals.db
		.select({
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
