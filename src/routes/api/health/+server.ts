import { count } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import { quizzes } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

/**
 * Smoke endpoint: proves the Worker is up AND that its D1 binding answers queries.
 * Used by the end-to-end tests and safe to point a uptime check at.
 */
export const GET: RequestHandler = async ({ locals, request }) => {
	const requestId = request.headers.get('cf-ray') ?? crypto.randomUUID();

	try {
		const [row] = await locals.db.select({ value: count() }).from(quizzes);

		return json(
			{ status: 'ok', database: 'ok', quizzes: row.value },
			{ headers: { 'cache-control': 'no-store', 'x-request-id': requestId } }
		);
	} catch (error) {
		console.error('[health] database check failed', { requestId, error });
		return json(
			{
				status: 'degraded',
				database: 'unreachable',
				requestId
			},
			{
				status: 503,
				headers: { 'cache-control': 'no-store', 'x-request-id': requestId }
			}
		);
	}
};
