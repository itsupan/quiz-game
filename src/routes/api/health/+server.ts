import { count } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import { quizzes } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

/**
 * Smoke endpoint: proves the Worker is up AND that its D1 binding answers queries.
 * Used by the end-to-end tests and safe to point a uptime check at.
 */
export const GET: RequestHandler = async ({ locals }) => {
	try {
		const [row] = await locals.db.select({ value: count() }).from(quizzes);

		return json({ status: 'ok', database: 'ok', quizzes: row.value });
	} catch (error) {
		return json(
			{
				status: 'degraded',
				database: 'unreachable',
				error: error instanceof Error ? error.message : String(error)
			},
			{ status: 503 }
		);
	}
};
