import { desc } from 'drizzle-orm';
import { quizzes } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const rows = await locals.db.select().from(quizzes).orderBy(desc(quizzes.createdAt));

	return { quizzes: rows };
};
